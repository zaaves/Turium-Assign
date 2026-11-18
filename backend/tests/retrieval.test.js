import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { retrievalService } from '../src/services/retrieval.service.js';

describe('Semantic Retrieval Service', () => {
  beforeEach(async () => {
    await prisma.chunk.deleteMany();
    await prisma.ingestionJob.deleteMany();
    await prisma.item.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should return empty array when database has no chunks', async () => {
    const results = await retrievalService.retrieveRelevantChunks([0.1, 0.2, 0.3]);
    expect(results).toEqual([]);
  });

  it('should only retrieve chunks from COMPLETED items', async () => {
    // Completed item
    const completedItem = await prisma.item.create({
      data: {
        title: 'Completed Item',
        sourceType: 'NOTE',
        rawContent: 'Completed content',
        status: 'COMPLETED',
        chunks: {
          create: {
            chunkIndex: 0,
            content: 'Searchable content chunk',
            embedding: JSON.stringify([1, 0, 0]),
            embeddingProvider: 'mock',
            embeddingModel: 'mock',
            embeddingDimensions: 3,
          },
        },
      },
    });

    // Pending item (should be excluded)
    await prisma.item.create({
      data: {
        title: 'Pending Item',
        sourceType: 'NOTE',
        rawContent: 'Pending content',
        status: 'PENDING',
        chunks: {
          create: {
            chunkIndex: 0,
            content: 'Unprocessed chunk',
            embedding: JSON.stringify([1, 0, 0]),
            embeddingProvider: 'mock',
            embeddingModel: 'mock',
            embeddingDimensions: 3,
          },
        },
      },
    });

    const results = await retrievalService.retrieveRelevantChunks([1, 0, 0], { topK: 5 });

    expect(results.length).toBe(1);
    expect(results[0].item.id).toBe(completedItem.id);
    expect(results[0].item.title).toBe('Completed Item');
  });

  it('should rank chunks descending by cosine similarity', async () => {
    const item = await prisma.item.create({
      data: {
        title: 'Multi Chunk Item',
        sourceType: 'NOTE',
        rawContent: 'Content with varying similarity',
        status: 'COMPLETED',
      },
    });

    // Create 3 chunks with known vectors
    // Query vector will be [1, 0, 0]
    await prisma.chunk.createMany({
      data: [
        {
          itemId: item.id,
          chunkIndex: 0,
          content: 'Low similarity chunk',
          embedding: JSON.stringify([0.1, 0.9, 0]), // Sim ~ 0.11
          embeddingProvider: 'mock',
          embeddingModel: 'mock',
          embeddingDimensions: 3,
        },
        {
          itemId: item.id,
          chunkIndex: 1,
          content: 'High similarity chunk',
          embedding: JSON.stringify([0.9, 0.1, 0]), // Sim ~ 0.99
          embeddingProvider: 'mock',
          embeddingModel: 'mock',
          embeddingDimensions: 3,
        },
        {
          itemId: item.id,
          chunkIndex: 2,
          content: 'Medium similarity chunk',
          embedding: JSON.stringify([0.6, 0.6, 0]), // Sim ~ 0.707
          embeddingProvider: 'mock',
          embeddingModel: 'mock',
          embeddingDimensions: 3,
        },
      ],
    });

    const results = await retrievalService.retrieveRelevantChunks([1, 0, 0], { topK: 3 });

    expect(results.length).toBe(3);
    expect(results[0].content).toBe('High similarity chunk');
    expect(results[1].content).toBe('Medium similarity chunk');
    expect(results[2].content).toBe('Low similarity chunk');
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    expect(results[1].similarity).toBeGreaterThan(results[2].similarity);
  });

  it('should filter out chunks below minSimilarity threshold and respect topK limit', async () => {
    const item = await prisma.item.create({
      data: {
        title: 'Threshold Item',
        sourceType: 'NOTE',
        rawContent: 'Content for threshold testing',
        status: 'COMPLETED',
      },
    });

    await prisma.chunk.createMany({
      data: [
        {
          itemId: item.id,
          chunkIndex: 0,
          content: 'Irrelevant chunk',
          embedding: JSON.stringify([0, 1, 0]), // Orthogonal: sim = 0.0
          embeddingProvider: 'mock',
          embeddingModel: 'mock',
          embeddingDimensions: 3,
        },
        {
          itemId: item.id,
          chunkIndex: 1,
          content: 'Relevant chunk 1',
          embedding: JSON.stringify([0.95, 0.05, 0]), // High: sim ~ 0.99
          embeddingProvider: 'mock',
          embeddingModel: 'mock',
          embeddingDimensions: 3,
        },
        {
          itemId: item.id,
          chunkIndex: 2,
          content: 'Relevant chunk 2',
          embedding: JSON.stringify([0.8, 0.2, 0]), // High: sim ~ 0.97
          embeddingProvider: 'mock',
          embeddingModel: 'mock',
          embeddingDimensions: 3,
        },
      ],
    });

    // minSimilarity = 0.5 should exclude the irrelevant chunk
    const results = await retrievalService.retrieveRelevantChunks([1, 0, 0], {
      minSimilarity: 0.5,
      topK: 1, // Only top 1
    });

    expect(results.length).toBe(1);
    expect(results[0].content).toBe('Relevant chunk 1');
  });
});
