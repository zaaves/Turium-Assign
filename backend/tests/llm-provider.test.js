import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiLLMProvider } from '../src/providers/llm/gemini.llm.js';
import { MockLLMProvider } from '../src/providers/llm/index.js';

describe('LLM Providers & Gemini Flash Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('MockLLMProvider', () => {
    it('should return grounded mock response when context has source labels', async () => {
      const mock = new MockLLMProvider();
      const res = await mock.generateAnswer({
        systemPrompt: 'Grounding prompt',
        userPrompt: 'Context: [S1] React is a library. Question: What is React?',
      });

      expect(res.text).toContain('[S1]');
      expect(res.usage).toBeDefined();
    });

    it('should return insufficient information when no context labels exist', async () => {
      const mock = new MockLLMProvider();
      const res = await mock.generateAnswer({
        systemPrompt: 'Grounding prompt',
        userPrompt: 'Question without any context',
      });

      expect(res.text).toContain('does not provide enough information');
    });
  });

  describe('GeminiLLMProvider', () => {
    it('should throw when GEMINI_API_KEY is not configured', async () => {
      const provider = new GeminiLLMProvider({ apiKey: '' });
      await expect(
        provider.generateAnswer({ userPrompt: 'Hello' })
      ).rejects.toThrow(/Gemini API key is not configured/);
    });

    it('should format generateContent request with systemInstruction and parse answer', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Grounded response based on saved notes [S1].' }],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 120,
            candidatesTokenCount: 15,
          },
        }),
      });

      const provider = new GeminiLLMProvider({
        apiKey: 'test-api-key',
        model: 'gemini-3.8-flash',
      });

      const result = await provider.generateAnswer({
        systemPrompt: 'Use only context.',
        userPrompt: 'Context: [S1] React is a library. Question: What is React?',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];

      expect(url).toContain('/models/gemini-3.8-flash:generateContent');
      expect(url).toContain('key=test-api-key');

      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.systemInstruction.parts[0].text).toBe('Use only context.');
      expect(parsedBody.contents[0].parts[0].text).toContain('Context: [S1]');

      expect(result.text).toBe('Grounded response based on saved notes [S1].');
      expect(result.usage.promptTokenCount).toBe(120);
    });

    it('should retry on HTTP 429 rate limit response and succeed on subsequent attempt', async () => {
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: async () => JSON.stringify({ error: { message: 'Quota exceeded for LLM' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Answer after backoff.' }],
                },
              },
            ],
          }),
        });

      const provider = new GeminiLLMProvider({
        apiKey: 'test-api-key',
      });

      const result = await provider.generateAnswer({
        userPrompt: 'Question',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.text).toBe('Answer after backoff.');
    });

    it('should throw an error on safety block from Gemini', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: 'SAFETY',
            },
          ],
        }),
      });

      const provider = new GeminiLLMProvider({ apiKey: 'test-api-key' });

      await expect(provider.generateAnswer({ userPrompt: 'Unsafe prompt' })).rejects.toThrow(
        /Gemini generation stopped unexpectedly with finishReason: SAFETY/
      );
    });
  });
});
