import { prisma } from '../config/prisma.js';
import { cosineSimilarity } from '../utils/cosine-similarity.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export class RetrievalService {
  /**
   * Retrieves the most relevant chunks for a given query vector.
   * Only includes chunks from successfully COMPLETED items.
   *
   * @param {number[]} queryVector - Normalized query vector
   * @param {object} [options]
   * @param {number} [options.topK] - Maximum number of chunks to return (default from env or 5)
   * @param {number} [options.minSimilarity] - Minimum cosine similarity threshold (default from env)
   * @returns {Promise<Array<{
   *   chunkId: string,
   *   chunkIndex: number,
   *   content: string,
   *   similarity: number,
   *   item: { id: string, title: string, sourceType: string, sourceUrl: string | null }
   * }>>}
   */
  async retrieveRelevantChunks(queryVector, options = {}) {
    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      return [];
    }

    const topK = options.topK !== undefined ? options.topK : (env.RAG_TOP_K || 5);
    const minSimilarity =
      options.minSimilarity !== undefined ? options.minSimilarity : (env.RAG_MIN_SIMILARITY || 0.0);

    // 1. Fetch chunks belonging ONLY to COMPLETED items
    const storedChunks = await prisma.chunk.findMany({
      where: {
        item: {
          status: 'COMPLETED',
        },
      },
      include: {
        item: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            sourceUrl: true,
            status: true,
          },
        },
      },
    });

    if (storedChunks.length === 0) {
      logger.info('No completed chunks available in database for retrieval');
      return [];
    }

    const scoredChunks = [];

    // 2. Compute similarity for each chunk
    for (const chunk of storedChunks) {
      try {
        const storedVector = JSON.parse(chunk.embedding);

        if (!Array.isArray(storedVector) || storedVector.length !== queryVector.length) {
          logger.warn(
            {
              chunkId: chunk.id,
              storedDims: chunk.embeddingDimensions,
              queryDims: queryVector.length,
            },
            'Skipping chunk due to embedding dimension mismatch'
          );
          continue;
        }

        const score = cosineSimilarity(queryVector, storedVector);

        // Filter out chunks below the similarity threshold
        if (score >= minSimilarity) {
          scoredChunks.push({
            chunkId: chunk.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            similarity: score,
            item: {
              id: chunk.item.id,
              title: chunk.item.title,
              sourceType: chunk.item.sourceType,
              sourceUrl: chunk.item.sourceUrl,
            },
          });
        }
      } catch (err) {
        logger.warn({ chunkId: chunk.id, err: err.message }, 'Failed to compute similarity for chunk');
      }
    }

    // 3. Sort descending by similarity score
    scoredChunks.sort((a, b) => b.similarity - a.similarity);

    // 4. Select top K
    const selected = scoredChunks.slice(0, topK);

    logger.info(
      {
        totalCandidateChunks: storedChunks.length,
        matchedChunks: scoredChunks.length,
        selectedTopK: selected.length,
        highestSimilarity: selected[0]?.similarity ?? 0,
      },
      'Semantic retrieval completed'
    );

    return selected;
  }
}

export const retrievalService = new RetrievalService();
