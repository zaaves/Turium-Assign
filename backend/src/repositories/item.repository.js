import { prisma } from '../config/prisma.js';

export class ItemRepository {
  /**
   * Transactionally creates an Item and its initial IngestionJob.
   */
  async createWithJob({ title, sourceType, sourceUrl = null, rawContent = '', maxAttempts = 3 }) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          title,
          sourceType,
          sourceUrl,
          rawContent,
          status: 'PENDING',
        },
      });

      const job = await tx.ingestionJob.create({
        data: {
          itemId: item.id,
          status: 'PENDING',
          attempts: 0,
          maxAttempts,
        },
      });

      return { item, job };
    });
  }

  /**
   * Retrieves items with chunk counts and metadata (excluding full rawContent for list view).
   */
  async findMany() {
    return prisma.item.findMany({
      select: {
        id: true,
        title: true,
        sourceType: true,
        sourceUrl: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { chunks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves a single item by ID with chunk count and full details.
   */
  async findById(id) {
    return prisma.item.findUnique({
      where: { id },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });
  }

  /**
   * Updates item status and optional content/metadata.
   */
  async update(id, data) {
    return prisma.item.update({
      where: { id },
      data,
    });
  }

  /**
   * Deletes all existing chunks for an item (ensures idempotent re-runs).
   */
  async clearChunks(itemId) {
    return prisma.chunk.deleteMany({
      where: { itemId },
    });
  }
}

export const itemRepository = new ItemRepository();
