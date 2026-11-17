import { env } from '../../config/env.js';

/**
 * Interface definition for Embedding providers:
 * embedDocuments(texts: string[]): Promise<number[][]>
 * embedQuery(text: string): Promise<number[]>
 */

class MockEmbeddingProvider {
  constructor(dimensions = 768) {
    this.dimensions = dimensions;
  }

  async embedDocuments(texts) {
    return texts.map(() => new Array(this.dimensions).fill(0.01));
  }

  async embedQuery(_text) {
    return new Array(this.dimensions).fill(0.01);
  }
}

const providers = {
  mock: new MockEmbeddingProvider(),
};

export function registerEmbeddingProvider(name, providerInstance) {
  providers[name] = providerInstance;
}

export function getEmbeddingProvider(name = env.EMBEDDING_PROVIDER) {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Embedding provider '${name}' is not registered.`);
  }
  return provider;
}
