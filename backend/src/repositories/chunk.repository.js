import { prisma } from '../config/prisma.js';

export class ChunkRepository {
  /**
   * Persists an array of chunk records for an item.
   *
   * @param {Array<{
   *   itemId: string,
   *   chunkIndex: number,
   *   content: string,
   *   tokenCount?: number,
   *   embedding: string,
   *   embeddingProvider: string,
   *   embeddingModel: string,
   *   embeddingDimensions: number
   * }>} chunks
   */
  async createMany(chunks) {
    if (!chunks || chunks.length === 0) {
      return { count: 0 };
    }

    return prisma.chunk.createMany({
      data: chunks,
    });
  }

  /**
   * Retrieves all chunks for a given item ordered by chunk index.
   */
  async findByItemId(itemId) {
    return prisma.chunk.findMany({
      where: { itemId },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  /**
   * Deletes all chunks associated with an item.
   */
  async deleteByItemId(itemId) {
    return prisma.chunk.deleteMany({
      where: { itemId },
    });
  }

  /**
   * Counts chunks for an item.
   */
  async countByItemId(itemId) {
    return prisma.chunk.count({
      where: { itemId },
    });
  }
}

export const chunkRepository = new ChunkRepository();
