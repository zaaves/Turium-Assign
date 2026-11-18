import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiEmbeddingProvider } from '../src/providers/embeddings/gemini.embeddings.js';
import { MockEmbeddingProvider } from '../src/providers/embeddings/index.js';

describe('Embedding Providers & Gemini Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('MockEmbeddingProvider', () => {
    it('should generate deterministic vectors of requested dimensions', async () => {
      const mock = new MockEmbeddingProvider(128);
      const docs = await mock.embedDocuments(['First text', 'Second text']);

      expect(docs.length).toBe(2);
      expect(docs[0].length).toBe(128);
      expect(docs[1].length).toBe(128);

      const query = await mock.embedQuery('Query text');
      expect(query.length).toBe(128);
    });
  });

  describe('GeminiEmbeddingProvider', () => {
    it('should throw an informative error if GEMINI_API_KEY is not configured', async () => {
      const provider = new GeminiEmbeddingProvider({ apiKey: '' });
      await expect(provider.embedDocuments(['sample'])).rejects.toThrow(/Gemini API key is not configured/);
      await expect(provider.embedQuery('sample query')).rejects.toThrow(/Gemini API key is not configured/);
    });

    it('should format batchEmbedContents requests and parse vector responses correctly', async () => {
      const dummyVectors = [
        new Array(768).fill(0.123),
        new Array(768).fill(-0.456),
      ];

      // Mock global fetch
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          embeddings: dummyVectors.map((v) => ({ values: v })),
        }),
      });

      const provider = new GeminiEmbeddingProvider({
        apiKey: 'test-api-key',
        model: 'gemini-embedding-001',
      });

      const result = await provider.embedDocuments(['Doc 1', 'Doc 2']);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toContain('/models/gemini-embedding-001:batchEmbedContents');
      expect(url).toContain('key=test-api-key');

      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.requests.length).toBe(2);
      expect(parsedBody.requests[0].content.parts[0].text).toBe('Doc 1');
      expect(parsedBody.requests[1].content.parts[0].text).toBe('Doc 2');

      expect(result.length).toBe(2);
      expect(result[0]).toEqual(dummyVectors[0]);
      expect(result[1]).toEqual(dummyVectors[1]);
    });

    it('should format embedContent requests for single query embedding', async () => {
      const dummyQueryVector = new Array(768).fill(0.789);

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          embedding: { values: dummyQueryVector },
        }),
      });

      const provider = new GeminiEmbeddingProvider({
        apiKey: 'test-api-key',
        model: 'gemini-embedding-001',
      });

      const vector = await provider.embedQuery('What is RAG?');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain('/models/gemini-embedding-001:embedContent');
      expect(vector).toEqual(dummyQueryVector);
    });

    it('should retry on HTTP 429 rate limit response and succeed on subsequent attempt', async () => {
      const dummyVector = [new Array(768).fill(0.1)];

      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: async () => JSON.stringify({ error: { message: 'Quota exceeded for embeddings' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            embeddings: [{ values: dummyVector[0] }],
          }),
        });

      const provider = new GeminiEmbeddingProvider({
        apiKey: 'test-api-key',
      });

      const result = await provider.embedDocuments(['Retry test document']);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.length).toBe(1);
      expect(result[0]).toEqual(dummyVector[0]);
    });

    it('should validate and reject inconsistent vector dimensions from provider', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          embeddings: [
            { values: new Array(768).fill(0.1) },
            { values: new Array(512).fill(0.2) }, // Mismatched dimensions!
          ],
        }),
      });

      const provider = new GeminiEmbeddingProvider({
        apiKey: 'test-api-key',
      });

      await expect(provider.embedDocuments(['Doc 1', 'Doc 2'])).rejects.toThrow(
        /Inconsistent vector dimensions/
      );
    });

    it('should reject vectors containing NaN or non-finite numbers', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          embeddings: [{ values: [0.1, NaN, 0.3] }],
        }),
      });

      const provider = new GeminiEmbeddingProvider({
        apiKey: 'test-api-key',
      });

      await expect(provider.embedDocuments(['Doc 1'])).rejects.toThrow(
        /Invalid numeric value/
      );
    });
  });
});
