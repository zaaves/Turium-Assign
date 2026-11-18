import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { ingestionService } from '../src/services/ingestion.service.js';
import { jobService } from '../src/services/job.service.js';

describe('Query API (POST /api/query)', () => {
  beforeEach(async () => {
    await prisma.chunk.deleteMany();
    await prisma.ingestionJob.deleteMany();
    await prisma.item.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should reject missing or empty question with HTTP 400', async () => {
    const resEmpty = await request(app).post('/api/query').send({ question: '   ' });
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.success).toBe(false);
    expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

    const resMissing = await request(app).post('/api/query').send({});
    expect(resMissing.status).toBe(400);
    expect(resMissing.body.error.message).toContain('question is required');
  });

  it('should reject invalid topK configuration with HTTP 400', async () => {
    const resNegative = await request(app).post('/api/query').send({ question: 'Hello', topK: 0 });
    expect(resNegative.status).toBe(400);
    expect(resNegative.body.error.message).toContain('topK must be at least 1');

    const resTooLarge = await request(app).post('/api/query').send({ question: 'Hello', topK: 50 });
    expect(resTooLarge.status).toBe(400);
    expect(resTooLarge.body.error.message).toContain('topK cannot exceed 20');
  });

  it('should return 200 with insufficient information message when database is empty', async () => {
    const res = await request(app).post('/api/query').send({
      question: 'What is the capital of France?',
    });

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toContain('does not contain enough information');
    expect(res.body.data.sources).toEqual([]);
    expect(res.body.data.retrieval.chunksRetrieved).toBe(0);
  });

  it('should return grounded answer with sources and snippets for saved knowledge', async () => {
    // 1. Ingest a note
    const item = await ingestionService.ingestNote({
      title: 'Full Stack Guide',
      content:
        'Turium AI builds enterprise knowledge systems. It uses RAG pipelines to retrieve context from SQLite vectors.',
    });

    // 2. Process through worker (creates chunk & vector)
    await jobService.processNextJob();

    // 3. Query via HTTP endpoint
    const res = await request(app).post('/api/query').send({
      question: 'What does Turium AI build?',
      topK: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toBeDefined();
    expect(typeof res.body.data.answer).toBe('string');

    // Sources check
    expect(res.body.data.sources.length).toBeGreaterThan(0);
    const source = res.body.data.sources[0];
    expect(source.itemId).toBe(item.id);
    expect(source.title).toBe('Full Stack Guide');
    expect(source.sourceType).toBe('NOTE');
    expect(source.snippet).toContain('Turium AI builds enterprise knowledge systems');

    // Retrieval metadata
    expect(res.body.data.retrieval).toEqual({
      chunksRetrieved: expect.any(Number),
      topSimilarity: expect.any(Number),
    });
  });
});
