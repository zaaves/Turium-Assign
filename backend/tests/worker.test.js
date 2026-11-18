import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { ingestionService } from '../src/services/ingestion.service.js';
import { jobService } from '../src/services/job.service.js';
import { jobRepository } from '../src/repositories/job.repository.js';
import * as urlExtractionService from '../src/services/url-extraction.service.js';

describe('Async Worker Queue & Ingestion Processing', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.chunk.deleteMany();
    await prisma.ingestionJob.deleteMany();
    await prisma.item.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should process a PENDING NOTE job to COMPLETED status', async () => {
    const item = await ingestionService.ingestNote({
      title: 'Note for Worker',
      content: 'This note should be processed by the worker service.',
    });

    expect(item.status).toBe('PENDING');

    // Worker claims and processes the job
    const processed = await jobService.processNextJob();
    expect(processed).toBe(true);

    // Verify updated Item and Job in DB
    const updatedItem = await prisma.item.findUnique({ where: { id: item.id } });
    const updatedJob = await prisma.ingestionJob.findFirst({ where: { itemId: item.id } });

    expect(updatedItem.status).toBe('COMPLETED');
    expect(updatedItem.errorMessage).toBeNull();
    expect(updatedJob.status).toBe('COMPLETED');
    expect(updatedJob.attempts).toBe(1);
    expect(updatedJob.lockedAt).toBeNull();
  });

  it('should process a PENDING URL job to COMPLETED and populate extracted title and content', async () => {
    // Mock the URL extraction service
    vi.spyOn(urlExtractionService, 'fetchAndExtractUrl').mockResolvedValue({
      title: 'Extracted Documentation Page',
      rawContent: 'This is the extracted body text from the external website.',
      finalUrl: 'https://example.com/docs',
    });

    const item = await ingestionService.ingestUrl({
      url: 'https://example.com/docs',
    });

    const processed = await jobService.processNextJob();
    expect(processed).toBe(true);

    const updatedItem = await prisma.item.findUnique({ where: { id: item.id } });
    const updatedJob = await prisma.ingestionJob.findFirst({ where: { itemId: item.id } });

    expect(updatedItem.status).toBe('COMPLETED');
    expect(updatedItem.title).toBe('Extracted Documentation Page');
    expect(updatedItem.rawContent).toBe('This is the extracted body text from the external website.');
    expect(updatedJob.status).toBe('COMPLETED');
    expect(updatedJob.attempts).toBe(1);
  });

  it('should handle failure with retry when attempts remain', async () => {
    // Mock URL extraction failure
    vi.spyOn(urlExtractionService, 'fetchAndExtractUrl').mockRejectedValue(
      new Error('Temporary upstream connection reset.')
    );

    const item = await ingestionService.ingestUrl({
      url: 'https://flaky-server.example.com',
    });

    const processed = await jobService.processNextJob();
    expect(processed).toBe(true);

    const updatedItem = await prisma.item.findUnique({ where: { id: item.id } });
    const updatedJob = await prisma.ingestionJob.findFirst({ where: { itemId: item.id } });

    // Job should be reset to PENDING for retry, attempts = 1
    expect(updatedJob.status).toBe('PENDING');
    expect(updatedJob.attempts).toBe(1);
    expect(updatedJob.lastError).toContain('Temporary upstream connection reset');
    expect(updatedJob.lockedAt).toBeNull();

    // Item indicates pending retry
    expect(updatedItem.status).toBe('PENDING');
    expect(updatedItem.errorMessage).toContain('Waiting for retry');
  });

  it('should mark job and item as FAILED when max retries are exhausted', async () => {
    vi.spyOn(urlExtractionService, 'fetchAndExtractUrl').mockRejectedValue(
      new Error('Permanent 404 Not Found.')
    );

    const item = await ingestionService.ingestUrl({
      url: 'https://dead-link.example.com',
    });

    // Run job 3 times (default maxAttempts = 3)
    await jobService.processNextJob(); // Attempt 1 -> PENDING
    await jobService.processNextJob(); // Attempt 2 -> PENDING
    await jobService.processNextJob(); // Attempt 3 -> FAILED

    const finalItem = await prisma.item.findUnique({ where: { id: item.id } });
    const finalJob = await prisma.ingestionJob.findFirst({ where: { itemId: item.id } });

    expect(finalJob.status).toBe('FAILED');
    expect(finalJob.attempts).toBe(3);
    expect(finalJob.lastError).toContain('Permanent 404 Not Found');

    expect(finalItem.status).toBe('FAILED');
    expect(finalItem.errorMessage).toContain('Permanent 404 Not Found');
  });

  it('should recover stale PROCESSING jobs whose lease has expired', async () => {
    const item = await ingestionService.ingestNote({
      title: 'Stale Note',
      content: 'This note was locked by a worker that crashed.',
    });

    // Simulate worker crash: set job to PROCESSING with lockedAt 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existingJob = await prisma.ingestionJob.findFirst({ where: { itemId: item.id } });

    await prisma.ingestionJob.update({
      where: { id: existingJob.id },
      data: {
        status: 'PROCESSING',
        lockedAt: tenMinutesAgo,
        attempts: 1,
      },
    });

    // Stale lock threshold is 5 minutes (300,000 ms)
    const claimedStaleJob = await jobRepository.claimNextJob(300000);
    expect(claimedStaleJob).toBeDefined();
    expect(claimedStaleJob.id).toBe(existingJob.id);
    expect(claimedStaleJob.attempts).toBe(2); // Attempt incremented
    expect(claimedStaleJob.status).toBe('PROCESSING');
  });

  it('should be idempotent: reprocessing clears existing chunks without creating duplicates', async () => {
    const item = await ingestionService.ingestNote({
      title: 'Idempotent Note',
      content: 'Initial content',
    });

    // Manually create two dummy chunks to simulate an interrupted/previous run
    await prisma.chunk.createMany({
      data: [
        {
          itemId: item.id,
          chunkIndex: 0,
          content: 'Old chunk 0',
          embedding: '[]',
          embeddingProvider: 'mock',
          embeddingModel: 'mock',
          embeddingDimensions: 3,
        },
        {
          itemId: item.id,
          chunkIndex: 1,
          content: 'Old chunk 1',
          embedding: '[]',
          embeddingProvider: 'mock',
          embeddingModel: 'mock',
          embeddingDimensions: 3,
        },
      ],
    });

    expect(await prisma.chunk.count({ where: { itemId: item.id } })).toBe(2);

    // Process job
    await jobService.processNextJob();

    // Verify old dummy chunks were cleared and replaced with newly generated chunks
    const chunksAfter = await prisma.chunk.findMany({ where: { itemId: item.id } });
    expect(chunksAfter.length).toBe(1);
    expect(chunksAfter[0].content).toBe('Initial content');
    expect(chunksAfter.some((c) => c.content.includes('Old chunk'))).toBe(false);

    const completedItem = await prisma.item.findUnique({ where: { id: item.id } });
    expect(completedItem.status).toBe('COMPLETED');
  });

  it('should return false when queue is empty', async () => {
    const processed = await jobService.processNextJob();
    expect(processed).toBe(false);
  });
});
