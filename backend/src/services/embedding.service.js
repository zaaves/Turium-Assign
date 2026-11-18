import { getEmbeddingProvider } from '../providers/embeddings/index.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../middleware/error.middleware.js';

export class EmbeddingService {
  constructor(options = {}) {
    this.providerName = options.providerName || env.EMBEDDING_PROVIDER;
    this.modelName = options.modelName || env.EMBEDDING_MODEL;
  }

  /**
   * Generates embeddings for an array of text chunks and prepares enriched database records.
   *
   * @param {Array<{ chunkIndex: number, content: string, tokenCount?: number }>} rawChunks
   * @param {string} itemId - The parent item ID
   * @returns {Promise<Array<{
   *   itemId: string,
   *   chunkIndex: number,
   *   content: string,
   *   tokenCount?: number,
   *   embedding: string,
   *   embeddingProvider: string,
   *   embeddingModel: string,
   *   embeddingDimensions: number
   * }>>}
   */
  async generateEmbeddingsForChunks(rawChunks, itemId) {
    if (!rawChunks || rawChunks.length === 0) {
      return [];
    }

    if (!itemId) {
      throw new AppError('itemId is required for embedding persistence.', 400, 'INVALID_ITEM_ID');
    }

    const provider = getEmbeddingProvider(this.providerName);
    const texts = rawChunks.map((c) => c.content);

    const startTime = Date.now();
    logger.info(
      {
        itemId,
        chunkCount: texts.length,
        provider: this.providerName,
        model: this.modelName,
      },
      'Generating chunk embeddings'
    );

    const vectors = await provider.embedDocuments(texts);

    if (!Array.isArray(vectors) || vectors.length !== rawChunks.length) {
      throw new AppError(
        `Embedding generation failed: expected ${rawChunks.length} vectors, got ${vectors?.length ?? 0}.`,
        502,
        'PROVIDER_ERROR'
      );
    }

    logger.info(
      {
        itemId,
        durationMs: Date.now() - startTime,
        dimensions: vectors[0]?.length || 0,
      },
      'Generated embeddings successfully'
    );

    return rawChunks.map((chunk, index) => {
      const vector = vectors[index];

      return {
        itemId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: JSON.stringify(vector),
        embeddingProvider: this.providerName,
        embeddingModel: this.modelName,
        embeddingDimensions: vector.length,
      };
    });
  }

  /**
   * Generates an embedding vector for a natural language query.
   *
   * @param {string} query
   * @returns {Promise<number[]>}
   */
  async generateQueryEmbedding(query) {
    const provider = getEmbeddingProvider(this.providerName);
    return provider.embedQuery(query);
  }
}

export const embeddingService = new EmbeddingService();
