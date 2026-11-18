import { z } from 'zod';

export const queryRequestSchema = z.object({
  question: z
    .string({ required_error: 'A question is required.' })
    .trim()
    .min(1, 'Question cannot be empty.')
    .max(1000, 'Question cannot exceed 1000 characters.'),
  topK: z.coerce.number().int().min(1, 'topK must be at least 1').max(20, 'topK cannot exceed 20').optional(),
});
