import { itemRepository } from '../repositories/item.repository.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../middleware/error.middleware.js';

export class IngestionService {
  /**
   * Accepts and queues a plain-text note.
   */
  async ingestNote({ title, content }) {
    let resolvedTitle = title?.trim();
    if (!resolvedTitle) {
      // Use first line of note, up to 60 chars, or default
      const firstLine = content.split('\n')[0].trim();
      resolvedTitle = firstLine ? firstLine.slice(0, 60) : 'Untitled Note';
    }

    const { item, job } = await itemRepository.createWithJob({
      title: resolvedTitle,
      sourceType: 'NOTE',
      sourceUrl: null,
      rawContent: content,
      maxAttempts: env.JOB_MAX_ATTEMPTS,
    });

    logger.info(
      { itemId: item.id, jobId: job.id, sourceType: item.sourceType },
      'Queued note for asynchronous processing'
    );

    return item;
  }

  /**
   * Accepts and queues a URL item.
   */
  async ingestUrl({ url }) {
    const { item, job } = await itemRepository.createWithJob({
      title: url,
      sourceType: 'URL',
      sourceUrl: url,
      rawContent: '',
      maxAttempts: env.JOB_MAX_ATTEMPTS,
    });

    logger.info(
      { itemId: item.id, jobId: job.id, sourceType: item.sourceType, url },
      'Queued URL for asynchronous processing'
    );

    return item;
  }

  /**
   * Retrieves list of saved items with chunk counts.
   */
  async getItems() {
    const items = await itemRepository.findMany();
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl,
      status: item.status,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt,
      chunkCount: item._count?.chunks ?? 0,
    }));
  }

  /**
   * Retrieves single item details.
   */
  async getItemById(id) {
    const item = await itemRepository.findById(id);
    if (!item) {
      throw new AppError(`Item with ID '${id}' was not found.`, 404, 'NOT_FOUND');
    }

    return {
      id: item.id,
      title: item.title,
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl,
      rawContent: item.rawContent,
      status: item.status,
      errorMessage: item.errorMessage,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      chunkCount: item._count?.chunks ?? 0,
    };
  }
}

export const ingestionService = new IngestionService();
