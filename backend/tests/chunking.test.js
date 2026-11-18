import { describe, it, expect } from 'vitest';
import { ChunkingService, estimateTokenCount } from '../src/services/chunking.service.js';

describe('Text Chunking Service', () => {
  const service = new ChunkingService({
    targetTokens: 40, // 160 chars target
    overlapTokens: 10, // 40 chars overlap
  });

  it('should return an empty array for empty or whitespace content', () => {
    expect(service.chunkText('')).toEqual([]);
    expect(service.chunkText('    ')).toEqual([]);
    expect(service.chunkText('\n\n  \n')).toEqual([]);
    expect(service.chunkText(null)).toEqual([]);
  });

  it('should return a single chunk for short notes that fit within target size', () => {
    const shortText = 'This is a brief note about architecture decisions.';
    const chunks = service.chunkText(shortText);

    expect(chunks.length).toBe(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toBe(shortText);
    expect(chunks[0].tokenCount).toBe(estimateTokenCount(shortText));
  });

  it('should split multi-paragraph content and preserve paragraph boundaries where possible', () => {
    const p1 = 'Paragraph one explains the background of the system and why we chose SQLite for local persistence.';
    const p2 = 'Paragraph two discusses the asynchronous worker queue that prevents HTTP handlers from blocking on long network requests.';
    const p3 = 'Paragraph three covers the retrieval-augmented generation pipeline, cosine similarity calculations, and grounded citation generation.';
    const p4 = 'Paragraph four summarizes the trade-offs of the local architecture compared to an enterprise pgvector cluster.';

    const fullText = [p1, p2, p3, p4].join('\n\n');
    const chunks = service.chunkText(fullText);

    expect(chunks.length).toBeGreaterThan(1);

    // Each chunk should have sequential index
    chunks.forEach((chunk, idx) => {
      expect(chunk.chunkIndex).toBe(idx);
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.tokenCount).toBeGreaterThan(0);
    });

    // Chunks should preserve paragraph text intact
    expect(chunks[0].content).toContain(p1);
  });

  it('should produce overlapping text between adjacent chunks', () => {
    const p1 = 'First section discussing machine learning embeddings and vector spaces in high dimensions.';
    const p2 = 'Second section focusing on text pre-processing and normalizing whitespace across documents.';
    const p3 = 'Third section explaining how cosine similarity measures the angular distance between vectors.';
    const p4 = 'Fourth section covering the LLM prompt construction with untrusted context brackets.';

    const fullText = [p1, p2, p3, p4].join('\n\n');
    const chunks = service.chunkText(fullText);

    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1].content;
      const currentChunk = chunks[i].content;

      // Check for overlap: words from the tail of prevChunk should appear at the start of currentChunk
      const prevWords = prevChunk.split(/\s+/).slice(-5);
      const overlapFound = prevWords.some((w) => currentChunk.includes(w));
      expect(overlapFound).toBe(true);
    }
  });

  it('should handle large single paragraphs by breaking down sentences or words', () => {
    // Generate one very long sentence without paragraph breaks (> 400 chars)
    const longSentence =
      'This is an exceptionally long paragraph designed to exceed the single target chunk size limit without containing any double newlines or paragraph separators so that the chunking service is forced to break down the stream into smaller segments along sentence and word boundaries rather than relying solely on paragraphs.';

    const chunks = service.chunkText(longSentence);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
  });

  it('should be strictly deterministic across repeated runs', () => {
    const sampleText = `
      Software architecture is the fundamental structure of a software system.
      Each decision carries tradeoffs in complexity, latency, and maintainability.

      Retrieval-Augmented Generation bridges external factual knowledge with LLMs.
      By chunking content and computing embeddings, we query relevant context accurately.
    `;

    const run1 = service.chunkText(sampleText);
    const run2 = service.chunkText(sampleText);

    expect(run1).toEqual(run2);
  });
});
