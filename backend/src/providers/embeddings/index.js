import { env } from '../../config/env.js';
import { GeminiEmbeddingProvider } from './gemini.embeddings.js';

export class MockEmbeddingProvider {
  constructor(dimensions = 768) {
    this.dimensions = dimensions;
  }

  async embedDocuments(texts) {
    return texts.map((t, idx) => {
      // Deterministic pseudo-vector based on character codes
      const vec = new Array(this.dimensions).fill(0);
      for (let i = 0; i < t.length; i++) {
        vec[i % this.dimensions] += (t.charCodeAt(i) % 100) / 1000 + (idx * 0.001);
      }
      return vec;
    });
  }

  async embedQuery(text) {
    const vec = new Array(this.dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % this.dimensions] += (text.charCodeAt(i) % 100) / 1000;
    }
    return vec;
  }
}

const providers = {
  gemini: new GeminiEmbeddingProvider(),
  mock: new MockEmbeddingProvider(768),
};

export function registerEmbeddingProvider(name, providerInstance) {
  providers[name] = providerInstance;
}

export function getEmbeddingProvider(name = env.EMBEDDING_PROVIDER) {
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
    throw new Error(`Embedding provider '${name}' is not registered. Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}
