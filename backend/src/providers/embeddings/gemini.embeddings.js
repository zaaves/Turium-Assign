import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../middleware/error.middleware.js';

const DEFAULT_BATCH_SIZE = 25;
const MAX_RETRIES = 2;

export class GeminiEmbeddingProvider {
  constructor(options = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : env.GEMINI_API_KEY;
    this.model = options.model || env.EMBEDDING_MODEL || 'gemini-embedding-001';
    this.baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  }

  /**
   * Generates embedding vectors for an array of document chunks in batches.
   *
   * @param {string[]} texts - Array of chunk texts
   * @returns {Promise<number[][]>}
   */
  async embedDocuments(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    this._validateApiKey();

    const allVectors = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batchTexts = texts.slice(i, i + this.batchSize);
      const batchVectors = await this._embedBatchWithRetry(batchTexts);
      allVectors.push(...batchVectors);
    }

    this._validateVectors(allVectors, texts.length);

    return allVectors;
  }

  /**
   * Generates a single embedding vector for a query string.
   *
   * @param {string} text - Query text
   * @returns {Promise<number[]>}
   */
  async embedQuery(text) {
    if (!text || typeof text !== 'string') {
      throw new AppError('Query text must be a non-empty string.', 400, 'INVALID_QUERY');
    }

    this._validateApiKey();

    const url = `${this.baseUrl}/models/${this.model}:embedContent?key=${this.apiKey}`;
    const payload = {
      model: `models/${this.model}`,
      content: {
        parts: [{ text }],
      },
    };

    const data = await this._sendRequestWithRetry(url, payload);

    if (!data.embedding || !Array.isArray(data.embedding.values)) {
      throw new AppError('Gemini API returned unexpected embedding response format.', 502, 'PROVIDER_ERROR');
    }

    const vector = data.embedding.values;
    if (vector.length === 0 || !vector.every((val) => typeof val === 'number' && Number.isFinite(val))) {
      throw new AppError('Invalid non-numeric or non-finite values in Gemini query vector.', 502, 'PROVIDER_ERROR');
    }

    return vector;
  }

  _validateApiKey() {
    if (!this.apiKey || this.apiKey === 'replace_me') {
      throw new AppError(
        'Gemini API key is not configured. Please supply a valid GEMINI_API_KEY in backend/.env',
        500,
        'PROVIDER_CONFIG_ERROR'
      );
    }
  }

  async _embedBatchWithRetry(texts) {
    const url = `${this.baseUrl}/models/${this.model}:batchEmbedContents?key=${this.apiKey}`;
    const payload = {
      requests: texts.map((text) => ({
        model: `models/${this.model}`,
        content: {
          parts: [{ text }],
        },
      })),
    };

    const data = await this._sendRequestWithRetry(url, payload);

    if (!data.embeddings || !Array.isArray(data.embeddings)) {
      throw new AppError(
        'Gemini API response did not contain the expected "embeddings" array.',
        502,
        'PROVIDER_ERROR'
      );
    }

    return data.embeddings.map((item, idx) => {
      if (!item || !Array.isArray(item.values)) {
        throw new AppError(
          `Missing embedding values for batch item at index ${idx}.`,
          502,
          'PROVIDER_ERROR'
        );
      }
      return item.values;
    });
  }

  async _sendRequestWithRetry(url, payload) {
    let attempt = 0;
    let delayMs = 1000;

    while (attempt <= MAX_RETRIES) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        });

        if (response.ok) {
          return await response.json();
        }

        const errorBody = await response.text();
        let parsedError;
        try {
          parsedError = JSON.parse(errorBody);
        } catch {
          parsedError = { message: errorBody };
        }

        const errorMessage = parsedError.error?.message || response.statusText || 'Unknown Gemini API error';

        // Check for rate limit (429) or temporary server error (503)
        if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
          attempt += 1;
          logger.warn(
            { attempt, status: response.status, delayMs, error: errorMessage },
            'Gemini API rate limited or temporarily unavailable; backing off'
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }

        logger.error(
          { status: response.status, error: parsedError },
          'Gemini API request failed permanently'
        );

        throw new AppError(
          `Gemini API error (HTTP ${response.status}): ${errorMessage}`,
          response.status === 429 ? 429 : 502,
          'GEMINI_API_ERROR'
        );
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        if (attempt < MAX_RETRIES) {
          attempt += 1;
          logger.warn({ attempt, delayMs, error: err.message }, 'Network error contacting Gemini API; retrying');
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }
        throw new AppError(`Network failure while contacting Gemini API: ${err.message}`, 502, 'PROVIDER_NETWORK_ERROR');
      }
    }
  }

  _validateVectors(vectors, expectedCount) {
    if (vectors.length !== expectedCount) {
      throw new AppError(
        `Embedding vector count mismatch: expected ${expectedCount}, received ${vectors.length}.`,
        502,
        'EMBEDDING_COUNT_MISMATCH'
      );
    }

    let expectedDimensions = null;

    for (let i = 0; i < vectors.length; i++) {
      const vec = vectors[i];
      if (!Array.isArray(vec) || vec.length === 0) {
        throw new AppError(`Empty or non-array vector returned for chunk ${i}.`, 502, 'INVALID_VECTOR');
      }

      if (expectedDimensions === null) {
        expectedDimensions = vec.length;
      } else if (vec.length !== expectedDimensions) {
        throw new AppError(
          `Inconsistent vector dimensions: chunk 0 has ${expectedDimensions} dims, but chunk ${i} has ${vec.length} dims.`,
          502,
          'DIMENSION_MISMATCH'
        );
      }

      for (let j = 0; j < vec.length; j++) {
        const val = vec[j];
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          throw new AppError(
            `Invalid numeric value at chunk ${i}, index ${j}: ${val}`,
            502,
            'INVALID_VECTOR_VALUE'
          );
        }
      }
    }
  }
}
