import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RAGService } from '../src/services/rag.service.js';
import { embeddingService } from '../src/services/embedding.service.js';
import { retrievalService } from '../src/services/retrieval.service.js';
import * as llmProviderModule from '../src/providers/llm/index.js';

describe('RAG Service & Citation Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return insufficient information response without calling LLM when no chunks are retrieved', async () => {
    vi.spyOn(embeddingService, 'generateQueryEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);
    vi.spyOn(retrievalService, 'retrieveRelevantChunks').mockResolvedValue([]);
    const llmSpy = vi.spyOn(llmProviderModule, 'getLLMProvider');

    const ragService = new RAGService({ llmProviderName: 'mock' });
    const result = await ragService.answerQuestion({ question: 'What is SQLite?' });

    expect(result.answer).toContain('does not contain enough information');
    expect(result.sources).toEqual([]);
    expect(result.retrieval.chunksRetrieved).toBe(0);
    expect(llmSpy).not.toHaveBeenCalled();
  });

  it('should map valid citations to retrieved chunk records and prune hallucinated labels', async () => {
    vi.spyOn(embeddingService, 'generateQueryEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);

    const mockChunks = [
      {
        chunkId: 'chunk-uuid-1',
        chunkIndex: 0,
        content: 'React is a frontend component library developed by Meta.',
        similarity: 0.95,
        item: {
          id: 'item-uuid-1',
          title: 'React Introduction',
          sourceType: 'NOTE',
          sourceUrl: null,
        },
      },
      {
        chunkId: 'chunk-uuid-2',
        chunkIndex: 0,
        content: 'Vite provides blazing fast development tooling using native ES modules.',
        similarity: 0.88,
        item: {
          id: 'item-uuid-2',
          title: 'Vite Documentation',
          sourceType: 'URL',
          sourceUrl: 'https://vite.dev',
        },
      },
    ];

    vi.spyOn(retrievalService, 'retrieveRelevantChunks').mockResolvedValue(mockChunks);

    // LLM generates text citing valid [S1], and a hallucinated [S99] label
    const fakeLLM = {
      async generateAnswer() {
        return {
          text: 'React is a frontend component library [S1]. It also uses phantom tools [S99].',
        };
      },
    };
    vi.spyOn(llmProviderModule, 'getLLMProvider').mockReturnValue(fakeLLM);

    const ragService = new RAGService();
    const result = await ragService.answerQuestion({ question: 'What is React?' });

    // Hallucinated label [S99] must be pruned from answer text
    expect(result.answer).toContain('React is a frontend component library [S1].');
    expect(result.answer).not.toContain('[S99]');

    // Only valid citations returned in sources array
    expect(result.sources.length).toBe(1);
    expect(result.sources[0]).toEqual({
      label: 'S1',
      itemId: 'item-uuid-1',
      title: 'React Introduction',
      sourceType: 'NOTE',
      sourceUrl: null,
      chunkId: 'chunk-uuid-1',
      snippet: 'React is a frontend component library developed by Meta.',
    });

    expect(result.retrieval.chunksRetrieved).toBe(2);
    expect(result.retrieval.topSimilarity).toBe(0.95);
  });

  it('should preserve URL sourceUrl in citation metadata for URL items', async () => {
    vi.spyOn(embeddingService, 'generateQueryEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);

    const mockChunks = [
      {
        chunkId: 'chunk-uuid-url',
        chunkIndex: 0,
        content: 'Official documentation for Prisma SQLite integration.',
        similarity: 0.92,
        item: {
          id: 'item-uuid-url',
          title: 'Prisma SQLite',
          sourceType: 'URL',
          sourceUrl: 'https://www.prisma.io/docs/sqlite',
        },
      },
    ];

    vi.spyOn(retrievalService, 'retrieveRelevantChunks').mockResolvedValue(mockChunks);

    const fakeLLM = {
      async generateAnswer() {
        return {
          text: 'Prisma provides type-safe SQLite support [S1].',
        };
      },
    };
    vi.spyOn(llmProviderModule, 'getLLMProvider').mockReturnValue(fakeLLM);

    const ragService = new RAGService();
    const result = await ragService.answerQuestion({ question: 'How does Prisma work with SQLite?' });

    expect(result.sources[0].sourceType).toBe('URL');
    expect(result.sources[0].sourceUrl).toBe('https://www.prisma.io/docs/sqlite');
  });
});
