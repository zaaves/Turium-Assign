import { env } from '../../config/env.js';
import { GeminiLLMProvider } from './gemini.llm.js';

export class MockLLMProvider {
  async generateAnswer({ userPrompt }) {
    // Check if context has source labels like [S1]
    const hasS1 = userPrompt.includes('[S1]');
    const hasS2 = userPrompt.includes('[S2]');

    if (hasS1 && hasS2) {
      return {
        text: 'Based on your saved knowledge, components split the UI into independent pieces [S1], while the documentation provides additional guidance [S2].',
        usage: { promptTokens: 42, completionTokens: 25 },
      };
    } else if (hasS1) {
      return {
        text: 'According to your saved knowledge [S1], the system is designed to provide grounded responses based on indexed chunks.',
        usage: { promptTokens: 30, completionTokens: 18 },
      };
    }

    return {
      text: 'The saved content does not provide enough information to answer this question.',
      usage: { promptTokens: 20, completionTokens: 15 },
    };
  }
}

const providers = {
  gemini: new GeminiLLMProvider(),
  mock: new MockLLMProvider(),
};

export function registerLLMProvider(name, providerInstance) {
  providers[name] = providerInstance;
}

export function getLLMProvider(name = env.LLM_PROVIDER) {
  // In test environment, use mock provider unless USE_REAL_AI is explicitly set
  if (name === 'gemini' && env.NODE_ENV === 'test' && process.env.USE_REAL_AI !== 'true') {
    return providers.mock;
  }

  // If requesting gemini without an API key, use mock
  if (name === 'gemini' && (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === 'replace_me')) {
    return providers.mock;
  }

  const provider = providers[name];
  if (!provider) {
    throw new Error(`LLM provider '${name}' is not registered. Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}
