import { env } from '../../config/env.js';

/**
 * Interface definition for LLM providers:
 * generateAnswer({ systemPrompt, userPrompt, temperature }): Promise<{ text: string, usage?: object }>
 */

class MockLLMProvider {
  async generateAnswer({ systemPrompt, userPrompt }) {
    return {
      text: `[Mock LLM Answer] Based on context: ${userPrompt.slice(0, 100)}...`,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}

const providers = {
  mock: new MockLLMProvider(),
};

export function registerLLMProvider(name, providerInstance) {
  providers[name] = providerInstance;
}

export function getLLMProvider(name = env.LLM_PROVIDER) {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`LLM provider '${name}' is not registered.`);
  }
  return provider;
}
