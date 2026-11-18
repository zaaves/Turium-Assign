import { jobRepository } from '../repositories/job.repository.js';
import { itemRepository } from '../repositories/item.repository.js';
import { chunkRepository } from '../repositories/chunk.repository.js';
import { fetchAndExtractUrl } from './url-extraction.service.js';
import { chunkingService } from './chunking.service.js';
import { embeddingService } from './embedding.service.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export class JobService {
  /**
   * Claims and processes a single pending or stale job from the queue.
   * Steps:
   * 1. Claim job & lock
   * 2. Extract content (for URL) or read rawContent (for NOTE)
   * 3. Split content into deterministic chunks
   * 4. Generate embeddings via the configured provider
   * 5. Atomically persist chunks and update item & job status to COMPLETED
   *
   * @returns {Promise<boolean>} true if a job was processed, false if queue was empty
   */
  async processNextJob() {
    const job = await jobRepository.claimNextJob(env.JOB_STALE_LOCK_MS);

    if (!job) {
      return false; // Queue empty
    }

    const { item } = job;
    const startTime = Date.now();

    logger.info(
      { jobId: job.id, itemId: item.id, sourceType: item.sourceType, attempt: job.attempts },
      'Started processing ingestion job'
    );

    try {
      let contentToChunk = item.rawContent;
      let extractedTitle = item.title;

      // 1. URL Extraction
      if (item.sourceType === 'URL') {
        const extraction = await fetchAndExtractUrl(item.sourceUrl);
        contentToChunk = extraction.rawContent;
        extractedTitle = extraction.title;
      }

      // 2. Text Chunking
      const rawChunks = chunkingService.chunkText(contentToChunk);

      // 3. Embedding Generation
      let enrichedChunks = [];
      if (rawChunks.length > 0) {
        enrichedChunks = await embeddingService.generateEmbeddingsForChunks(rawChunks, item.id);
      }

      // 4. Atomic Transaction: Clear previous chunks, save new chunks, mark item & job completed
      await prisma.$transaction(async (tx) => {
        // Clear previous chunks for idempotency
        await tx.chunk.deleteMany({
          where: { itemId: item.id },
        });

        // Insert new chunks
        if (enrichedChunks.length > 0) {
          await tx.chunk.createMany({
            data: enrichedChunks,
          });
        }

        // Update item
        await tx.item.update({
          where: { id: item.id },
          data: {
            title: extractedTitle,
            rawContent: contentToChunk,
            status: 'COMPLETED',
            errorMessage: null,
          },
        });

        // Mark job completed
        await tx.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            lockedAt: null,
          },
        });
      });

      logger.info(
        {
          jobId: job.id,
          itemId: item.id,
          chunksCreated: enrichedChunks.length,
          durationMs: Date.now() - startTime,
        },
        'Ingestion job completed successfully'
      );

      return true;
    } catch (err) {
      const willRetry = job.attempts < job.maxAttempts;
      const safeErrorMessage = err.message || 'Processing failed.';

      logger.warn(
        {
          jobId: job.id,
          itemId: item.id,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          willRetry,
          err: safeErrorMessage,
        },
        willRetry ? 'Ingestion job failed; scheduled for retry' : 'Ingestion job exhausted maximum retries'
      );

      // Update job state
      await jobRepository.failJob(job.id, safeErrorMessage, willRetry);

      // Update item state
      await itemRepository.update(item.id, {
        status: willRetry ? 'PENDING' : 'FAILED',
        errorMessage: willRetry ? `Processing attempt ${job.attempts} failed. Waiting for retry.` : safeErrorMessage,
      });

      return true;
    }
  }
}

export const jobService = new JobService();
