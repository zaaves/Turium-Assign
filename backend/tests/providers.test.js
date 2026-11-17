import { describe, it, expect } from 'vitest';
import { getLLMProvider, registerLLMProvider } from '../src/providers/llm/index.js';
import { getEmbeddingProvider, registerEmbeddingProvider } from '../src/providers/embeddings/index.js';

describe('Modular Provider Adapters', () => {
  it('should support registering and retrieving LLM providers', async () => {
    const customLLM = {
      async generateAnswer({ userPrompt }) {
        return { text: `Echo: ${userPrompt}` };
      },
    };
    registerLLMProvider('custom', customLLM);

    const provider = getLLMProvider('custom');
    expect(provider).toBeDefined();

    const result = await provider.generateAnswer({ userPrompt: 'Hello' });
    expect(result.text).toBe('Echo: Hello');
  });

  it('should support registering and retrieving Embedding providers', async () => {
    const customEmbedding = {
      async embedDocuments(texts) {
        return texts.map(() => [0.1, 0.2, 0.3]);
      },
      async embedQuery() {
        return [0.1, 0.2, 0.3];
      },
    };
    registerEmbeddingProvider('custom-embed', customEmbedding);

    const provider = getEmbeddingProvider('custom-embed');
    expect(provider).toBeDefined();

    const vectors = await provider.embedDocuments(['sample text']);
    expect(vectors).toEqual([[0.1, 0.2, 0.3]]);

    const queryVec = await provider.embedQuery('query');
    expect(queryVec).toEqual([0.1, 0.2, 0.3]);
  });
});
