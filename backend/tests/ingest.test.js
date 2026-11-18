import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Content Ingestion API (/api/ingest & /api/items)', () => {
  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.chunk.deleteMany();
    await prisma.ingestionJob.deleteMany();
    await prisma.item.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/ingest', () => {
    it('should accept a valid plain-text note and return HTTP 202 with PENDING item', async () => {
      const payload = {
        sourceType: 'NOTE',
        title: 'Meeting Notes on RAG Pipeline',
        content: 'We discussed building a minimal RAG pipeline with SQLite, Express, and React.',
      };

      const res = await request(app).post('/api/ingest').send(payload);

      expect(res.status).toBe(202);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.body).toEqual({
        success: true,
        data: {
          item: {
            id: expect.any(String),
            title: 'Meeting Notes on RAG Pipeline',
            sourceType: 'NOTE',
            status: 'PENDING',
            createdAt: expect.any(String),
          },
        },
        error: null,
      });

      // Verify DB persistence of Item and Job
      const createdItem = await prisma.item.findUnique({
        where: { id: res.body.data.item.id },
        include: { jobs: true },
      });

      expect(createdItem).toBeDefined();
      expect(createdItem.rawContent).toBe(payload.content);
      expect(createdItem.status).toBe('PENDING');
      expect(createdItem.jobs.length).toBe(1);
      expect(createdItem.jobs[0].status).toBe('PENDING');
      expect(createdItem.jobs[0].attempts).toBe(0);
    });

    it('should automatically derive title from the first line when title is omitted in NOTE', async () => {
      const payload = {
        sourceType: 'NOTE',
        content: 'Architecture Decision:\nWe decided to store JSON vectors in SQLite.',
      };

      const res = await request(app).post('/api/ingest').send(payload);

      expect(res.status).toBe(202);
      expect(res.body.data.item.title).toBe('Architecture Decision:');
    });

    it('should accept a valid URL and return HTTP 202 with PENDING item and job', async () => {
      const payload = {
        sourceType: 'URL',
        url: 'https://react.dev/learn',
      };

      const res = await request(app).post('/api/ingest').send(payload);

      expect(res.status).toBe(202);
      expect(res.body.data.item.sourceType).toBe('URL');
      expect(res.body.data.item.status).toBe('PENDING');

      const createdItem = await prisma.item.findUnique({
        where: { id: res.body.data.item.id },
        include: { jobs: true },
      });

      expect(createdItem.sourceUrl).toBe('https://react.dev/learn');
      expect(createdItem.jobs.length).toBe(1);
    });

    it('should reject NOTE with empty content (HTTP 400)', async () => {
      const res = await request(app).post('/api/ingest').send({
        sourceType: 'NOTE',
        content: '   ',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid sourceType (HTTP 400)', async () => {
      const res = await request(app).post('/api/ingest').send({
        sourceType: 'PDF',
        content: 'some pdf text',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject unsupported URL protocol (HTTP 400)', async () => {
      const res = await request(app).post('/api/ingest').send({
        sourceType: 'URL',
        url: 'ftp://ftp.example.com/file.txt',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Only http and https protocols are supported');
    });
  });

  describe('GET /api/items and GET /api/items/:id', () => {
    it('should return a list of items with chunk counts and without exposing rawContent', async () => {
      // Ingest two items
      await request(app).post('/api/ingest').send({
        sourceType: 'NOTE',
        title: 'Note 1',
        content: 'First secret note content',
      });

      await request(app).post('/api/ingest').send({
        sourceType: 'URL',
        url: 'https://example.com/docs',
      });

      const res = await request(app).get('/api/items');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);

      const firstItem = res.body.data.items[0];
      expect(firstItem.id).toBeDefined();
      expect(firstItem.title).toBeDefined();
      expect(firstItem.sourceType).toBeDefined();
      expect(firstItem.status).toBe('PENDING');
      expect(firstItem.chunkCount).toBe(0);
      expect(firstItem.rawContent).toBeUndefined(); // Must not expose raw content in list
    });

    it('should return detailed item information for GET /api/items/:id', async () => {
      const ingestRes = await request(app).post('/api/ingest').send({
        sourceType: 'NOTE',
        title: 'Detail Note',
        content: 'Full note content to verify detail view.',
      });

      const itemId = ingestRes.body.data.item.id;

      const res = await request(app).get(`/api/items/${itemId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.item).toEqual({
        id: itemId,
        title: 'Detail Note',
        sourceType: 'NOTE',
        sourceUrl: null,
        rawContent: 'Full note content to verify detail view.',
        status: 'PENDING',
        errorMessage: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        chunkCount: 0,
      });
    });

    it('should return 404 with NOT_FOUND for nonexistent item ID', async () => {
      const res = await request(app).get('/api/items/non-existent-uuid-1234');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('non-existent-uuid-1234'),
        },
      });
    });
  });
});
