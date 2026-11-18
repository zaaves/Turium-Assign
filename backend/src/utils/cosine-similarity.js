/**
 * Computes the cosine similarity between two numeric vectors.
 * Returns a value between -1.0 and 1.0 (or 0 if norm is 0).
 *
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Cosine similarity score
 * @throws {Error} If arguments are not arrays, contains non-numeric values, or lengths differ
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new Error('Both arguments must be arrays of numbers.');
  }

  if (a.length !== b.length) {
    throw new Error(`Embedding dimensions do not match: vector A has ${a.length} dims, vector B has ${b.length} dims.`);
  }

  if (a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const valA = a[i];
    const valB = b[i];

    if (typeof valA !== 'number' || typeof valB !== 'number' || !Number.isFinite(valA) || !Number.isFinite(valB)) {
      throw new Error(`Invalid non-finite or non-numeric vector component at index ${i}.`);
    }

    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));

  // Guard against floating point inaccuracies beyond [-1, 1]
  return Math.max(-1, Math.min(1, similarity));
}
