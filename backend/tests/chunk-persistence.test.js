import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { chunkRepository } from '../src/repositories/chunk.repository.js';
import { itemRepository } from '../src/repositories/item.repository.js';

describe('Chunk Persistence & Database Relationships', () => {
  beforeEach(async () => {
    await prisma.chunk.deleteMany();
    await prisma.ingestionJob.deleteMany();
    await prisma.item.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should store chunk text and serialized vector embeddings with metadata', async () => {
    const { item } = await itemRepository.createWithJob({
      title: 'Vector Test Note',
      sourceType: 'NOTE',
      rawContent: 'Sample content to be chunked and embedded.',
    });

    const dummyVector = [0.123, -0.456, 0.789];
    const chunkData = [
      {
        itemId: item.id,
        chunkIndex: 0,
        content: 'Sample content chunk 0',
        tokenCount: 6,
        embedding: JSON.stringify(dummyVector),
        embeddingProvider: 'gemini',
        embeddingModel: 'gemini-embedding-001',
        embeddingDimensions: 3,
      },
      {
        itemId: item.id,
        chunkIndex: 1,
        content: 'Sample content chunk 1',
        tokenCount: 6,
        embedding: JSON.stringify(dummyVector),
        embeddingProvider: 'gemini',
        embeddingModel: 'gemini-embedding-001',
        embeddingDimensions: 3,
      },
    ];

    await chunkRepository.createMany(chunkData);

    const persistedChunks = await chunkRepository.findByItemId(item.id);
    expect(persistedChunks.length).toBe(2);

    expect(persistedChunks[0].chunkIndex).toBe(0);
    expect(persistedChunks[0].content).toBe('Sample content chunk 0');
    expect(persistedChunks[0].embeddingProvider).toBe('gemini');
    expect(persistedChunks[0].embeddingModel).toBe('gemini-embedding-001');
    expect(persistedChunks[0].embeddingDimensions).toBe(3);

    // Verify embedding can be parsed back into numeric vector
    const parsedVector = JSON.parse(persistedChunks[0].embedding);
    expect(parsedVector).toEqual(dummyVector);

    // Verify chunk count via item relation
    const itemWithCount = await itemRepository.findById(item.id);
    expect(itemWithCount._count.chunks).toBe(2);
  });

  it('should enforce unique constraint on (itemId, chunkIndex)', async () => {
    const { item } = await itemRepository.createWithJob({
      title: 'Duplicate Index Test',
      sourceType: 'NOTE',
      rawContent: 'Testing unique index constraint.',
    });

    await prisma.chunk.create({
      data: {
        itemId: item.id,
        chunkIndex: 0,
        content: 'Original chunk 0',
        embedding: '[]',
        embeddingProvider: 'gemini',
        embeddingModel: 'gemini-embedding-001',
        embeddingDimensions: 0,
      },
    });

    // Attempting to insert duplicate chunkIndex for the same itemId must fail
    await expect(
      prisma.chunk.create({
        data: {
          itemId: item.id,
          chunkIndex: 0, // Duplicate!
          content: 'Duplicate chunk 0',
          embedding: '[]',
          embeddingProvider: 'gemini',
          embeddingModel: 'gemini-embedding-001',
          embeddingDimensions: 0,
        },
      })
    ).rejects.toThrow();
  });

  it('should cascade delete chunks when parent item is deleted', async () => {
    const { item } = await itemRepository.createWithJob({
      title: 'Cascade Delete Test',
      sourceType: 'NOTE',
      rawContent: 'Testing cascade delete of chunks.',
    });

    await prisma.chunk.create({
      data: {
        itemId: item.id,
        chunkIndex: 0,
        content: 'Chunk to be cascade deleted',
        embedding: '[]',
        embeddingProvider: 'gemini',
        embeddingModel: 'gemini-embedding-001',
        embeddingDimensions: 0,
      },
    });

    expect(await chunkRepository.countByItemId(item.id)).toBe(1);

    // Delete item
    await prisma.item.delete({ where: { id: item.id } });

    // Associated chunks should be removed automatically
    expect(await chunkRepository.countByItemId(item.id)).toBe(0);
  });
});
