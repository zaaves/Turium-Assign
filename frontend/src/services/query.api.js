import { apiRequest } from './apiClient';

/**
 * Submits a natural language question to the RAG query API.
 *
 * @param {object} params
 * @param {string} params.question - User question
 * @param {number} [params.topK=5] - Maximum chunks to retrieve
 * @returns {Promise<{
 *   answer: string,
 *   sources: Array<{
 *     label: string,
 *     itemId: string,
 *     title: string,
 *     sourceType: string,
 *     sourceUrl: string | null,
 *     chunkId: string,
 *     snippet: string
 *   }>,
 *   retrieval: {
 *     chunksRetrieved: number,
 *     topSimilarity: number
 *   }
 * }>}
 */
export async function submitQuery({ question, topK = 5 }) {
  const res = await apiRequest('/api/query', {
    method: 'POST',
    body: JSON.stringify({
      question: question.trim(),
      topK,
    }),
  });

  return res.data;
}
