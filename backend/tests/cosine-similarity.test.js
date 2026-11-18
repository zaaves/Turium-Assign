import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../src/utils/cosine-similarity.js';

describe('Cosine Similarity Utility', () => {
  it('should return 1.0 for identical vectors', () => {
    const a = [1, 2, 3, 4];
    const b = [1, 2, 3, 4];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });

  it('should return 1.0 for scaled identical vectors', () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });

  it('should return -1.0 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('should return 0.0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it('should return 0.0 for zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
    expect(cosineSimilarity(a, a)).toBe(0);
  });

  it('should throw an error for mismatched vector dimensions', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow(/Embedding dimensions do not match/);
  });

  it('should throw an error for non-array inputs or non-numeric values', () => {
    expect(() => cosineSimilarity('vector', [1, 2])).toThrow(/Both arguments must be arrays/);
    expect(() => cosineSimilarity([1, NaN], [1, 2])).toThrow(/Invalid non-finite or non-numeric/);
    expect(() => cosineSimilarity([1, 2], [1, 'string'])).toThrow(/Invalid non-finite or non-numeric/);
  });
});
