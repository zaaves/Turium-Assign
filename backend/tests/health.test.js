import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('API Foundation & Health Endpoints', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/health should return 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body).toEqual({
      success: true,
      data: expect.objectContaining({
        status: 'healthy',
        timestamp: expect.any(String),
      }),
      error: null,
    });
  });

  it('GET /api/unknown-route should return 404 in standardized error envelope', async () => {
    const res = await request(app).get('/api/unknown-route');

    expect(res.status).toBe(404);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('/api/unknown-route'),
      },
    });
  });

  it('Database connection via Prisma should be healthy', async () => {
    const items = await prisma.item.findMany();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
  });
});
