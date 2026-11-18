import { z } from 'zod';
import { env } from '../config/env.js';

const noteSchema = z.object({
  sourceType: z.literal('NOTE'),
  title: z.string().trim().max(255).optional(),
  content: z
    .string({ required_error: 'Note content is required.' })
    .trim()
    .min(1, 'Note content cannot be empty.')
    .max(env.MAX_INGEST_BYTES, `Note content cannot exceed ${env.MAX_INGEST_BYTES} bytes.`),
});

const urlSchema = z.object({
  sourceType: z.literal('URL'),
  url: z
    .string({ required_error: 'A valid URL is required.' })
    .trim()
    .url('Must be a valid URL format.')
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://'),
      'Only http and https protocols are supported.'
    ),
});

export const ingestRequestSchema = z.discriminatedUnion('sourceType', [
  noteSchema,
  urlSchema,
]);
