import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().default('file:./dev.db'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),

  LLM_PROVIDER: z.string().default('gemini'),
  LLM_MODEL: z.string().default('gemini-3.8-flash'),
  GEMINI_API_KEY: z.string().optional().default(''),

  EMBEDDING_PROVIDER: z.string().default('gemini'),
  EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),

  RAG_TOP_K: z.coerce.number().min(1).max(20).default(5),
  RAG_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.0),
  CHUNK_TARGET_TOKENS: z.coerce.number().positive().default(500),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().nonnegative().default(50),

  WORKER_POLL_INTERVAL_MS: z.coerce.number().positive().default(2000),
  JOB_MAX_ATTEMPTS: z.coerce.number().positive().default(3),
  JOB_STALE_LOCK_MS: z.coerce.number().positive().default(300000),
  MAX_INGEST_BYTES: z.coerce.number().positive().default(2000000),
  URL_FETCH_TIMEOUT_MS: z.coerce.number().positive().default(15000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
