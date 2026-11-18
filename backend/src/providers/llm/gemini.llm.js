import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../middleware/error.middleware.js';

const MAX_RETRIES = 2;

export class GeminiLLMProvider {
  constructor(options = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : env.GEMINI_API_KEY;
    this.model = options.model || env.LLM_MODEL || 'gemini-3-flash-preview';
    this.baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Generates a grounded completion using Gemini Flash.
   *
   * @param {object} params
   * @param {string} params.systemPrompt - Grounding and formatting instructions
   * @param {string} params.userPrompt - Formatted context and user question
   * @param {number} [params.temperature=0.2] - Generation temperature
   * @returns {Promise<{ text: string, usage?: object }>}
   */
  async generateAnswer({ systemPrompt, userPrompt, temperature = 0.2 }) {
    this._validateApiKey();

    if (!userPrompt || typeof userPrompt !== 'string') {
      throw new AppError('User prompt must be a non-empty string.', 400, 'INVALID_PROMPT');
    }

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: 2048,
      },
    };

    if (systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    // Try primary model, with fallback if primary is overloaded (503) or unavailable
    const candidateModels = [this.model];
    if (!candidateModels.includes('gemini-3-flash-preview')) {
      candidateModels.push('gemini-3-flash-preview');
    }
    if (!candidateModels.includes('gemini-2.5-flash')) {
      candidateModels.push('gemini-2.5-flash');
    }

    let lastError = null;
    for (const modelToTry of candidateModels) {
      try {
        const url = `${this.baseUrl}/models/${modelToTry}:generateContent?key=${this.apiKey}`;
        const data = await this._sendRequestWithRetry(url, payload);

        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content?.parts?.[0]?.text) {
          const finishReason = candidate?.finishReason;
          if (finishReason && finishReason !== 'STOP') {
            throw new AppError(
              `Gemini generation stopped unexpectedly with finishReason: ${finishReason}`,
              502,
              'GEMINI_SAFETY_BLOCK'
            );
          }
          throw new AppError('Gemini API returned an empty or invalid candidate response.', 502, 'PROVIDER_ERROR');
        }

        const answerText = candidate.content.parts[0].text.trim();

        return {
          text: answerText,
          usage: data.usageMetadata || null,
        };
      } catch (err) {
        lastError = err;
        logger.warn({ model: modelToTry, error: err.message }, 'Gemini model attempt failed; trying next candidate if available');
      }
    }

    throw lastError || new AppError('All Gemini candidate models failed to generate answer.', 502, 'PROVIDER_ERROR');
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

        if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
          attempt += 1;
          logger.warn(
            { attempt, status: response.status, delayMs, error: errorMessage },
            'Gemini LLM API rate limited or temporarily unavailable; backing off'
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }

        logger.error(
          { status: response.status, error: parsedError },
          'Gemini LLM API request failed permanently'
        );

        throw new AppError(
          `Gemini LLM error (HTTP ${response.status}): ${errorMessage}`,
          response.status === 429 ? 429 : 502,
          'GEMINI_API_ERROR'
        );
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        if (attempt < MAX_RETRIES) {
          attempt += 1;
          logger.warn({ attempt, delayMs, error: err.message }, 'Network error contacting Gemini LLM API; retrying');
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2;
          continue;
        }
        throw new AppError(`Network failure while contacting Gemini LLM API: ${err.message}`, 502, 'PROVIDER_NETWORK_ERROR');
      }
    }
  }
}
