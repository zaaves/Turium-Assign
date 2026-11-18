import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { ingestionService } from '../src/services/ingestion.service.js';
import { jobService } from '../src/services/job.service.js';
import { embeddingService } from '../src/services/embedding.service.js';
import * as urlExtractionService from '../src/services/url-extraction.service.js';

describe('Worker Ingestion & Embedding Pipeline Integration', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.chunk.deleteMany();
    await prisma.ingestionJob.deleteMany();
    await prisma.item.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should chunk, embed, and persist vectors for a multi-paragraph NOTE', async () => {
    const noteContent = `
      Retrieval-Augmented Generation (RAG) is an architecture that optimizes the output of an LLM.
      It references an authoritative knowledge base outside of its training data sources before generating a response.

      Embeddings are numerical vector representations of textual concepts.
      By comparing cosine similarity between query vectors and chunk vectors, relevant passages are retrieved.

      SQLite is chosen for local storage because it is zero-configuration and persists to a single file.
      JSON vector serialization makes it simple to test locally without needing Redis or Pinecone.
    `;

    const item = await ingestionService.ingestNote({
      title: 'RAG Architectural Guide',
      content: noteContent,
    });

    expect(item.status).toBe('PENDING');

    // Run the worker step
    const processed = await jobService.processNextJob();
    expect(processed).toBe(true);

    // Verify DB item state
    const updatedItem = await prisma.item.findUnique({
      where: { id: item.id },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } }, jobs: true },
    });

    expect(updatedItem.status).toBe('COMPLETED');
    expect(updatedItem.errorMessage).toBeNull();
    expect(updatedItem.jobs[0].status).toBe('COMPLETED');

    // Verify persisted chunks
    expect(updatedItem.chunks.length).toBeGreaterThan(0);
    const firstChunk = updatedItem.chunks[0];
    expect(firstChunk.chunkIndex).toBe(0);
    expect(firstChunk.embeddingProvider).toBeDefined();
    expect(firstChunk.embeddingModel).toBeDefined();
    expect(firstChunk.embeddingDimensions).toBeGreaterThan(0);

    const parsedVector = JSON.parse(firstChunk.embedding);
    expect(Array.isArray(parsedVector)).toBe(true);
    expect(parsedVector.length).toBe(firstChunk.embeddingDimensions);

    // Verify chunkCount via GET /api/items
    const listRes = await request(app).get('/api/items');
    expect(listRes.status).toBe(200);
    const listedItem = listRes.body.data.items.find((i) => i.id === item.id);
    expect(listedItem.chunkCount).toBe(updatedItem.chunks.length);
  });

  it('should chunk, embed, and persist vectors for a web URL', async () => {
    vi.spyOn(urlExtractionService, 'fetchAndExtractUrl').mockResolvedValue({
      title: 'Prisma SQLite Documentation',
      rawContent:
        'Prisma provides type-safe database queries. With SQLite, it stores data in a local file. Models are defined in schema.prisma and migrations are tracked automatically.',
      finalUrl: 'https://prisma.io/docs/sqlite',
    });

    const item = await ingestionService.ingestUrl({
      url: 'https://prisma.io/docs/sqlite',
    });

    const processed = await jobService.processNextJob();
    expect(processed).toBe(true);

    const updatedItem = await prisma.item.findUnique({
      where: { id: item.id },
      include: { chunks: true },
    });

    expect(updatedItem.status).toBe('COMPLETED');
    expect(updatedItem.title).toBe('Prisma SQLite Documentation');
    expect(updatedItem.chunks.length).toBeGreaterThan(0);
  });

  it('should safely handle embedding failure without creating orphan chunks, and allow retry', async () => {
    // Force embedding service failure
    vi.spyOn(embeddingService, 'generateEmbeddingsForChunks').mockRejectedValue(
      new Error('Temporary Gemini embedding quota exceeded (HTTP 429).')
    );

    const item = await ingestionService.ingestNote({
      title: 'Quota Failure Test',
      content: 'This note will encounter an embedding error on its first attempt.',
    });

    // Run worker step (Attempt 1)
    await jobService.processNextJob();

    // Verify item and job are scheduled for retry
    const itemAfterFail = await prisma.item.findUnique({
      where: { id: item.id },
      include: { chunks: true, jobs: true },
    });

    expect(itemAfterFail.status).toBe('PENDING');
    expect(itemAfterFail.errorMessage).toContain('Waiting for retry');
    expect(itemAfterFail.jobs[0].status).toBe('PENDING');
    expect(itemAfterFail.jobs[0].attempts).toBe(1);
    expect(itemAfterFail.chunks.length).toBe(0); // No orphan chunks!

    // Restore embedding service and run worker again (Attempt 2)
    vi.restoreAllMocks();
    const secondProcess = await jobService.processNextJob();
    expect(secondProcess).toBe(true);

    const itemAfterSuccess = await prisma.item.findUnique({
      where: { id: item.id },
      include: { chunks: true, jobs: true },
    });

    expect(itemAfterSuccess.status).toBe('COMPLETED');
    expect(itemAfterSuccess.jobs[0].status).toBe('COMPLETED');
    expect(itemAfterSuccess.jobs[0].attempts).toBe(2);
    expect(itemAfterSuccess.chunks.length).toBeGreaterThan(0);
  });
});
