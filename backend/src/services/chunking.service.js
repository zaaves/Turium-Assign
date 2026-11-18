import { env } from '../config/env.js';

const CHARS_PER_TOKEN = 4;

/**
 * Calculates approximate token count from character length.
 */
export function estimateTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export class ChunkingService {
  constructor(options = {}) {
    const targetTokens = options.targetTokens || env.CHUNK_TARGET_TOKENS || 500;
    const overlapTokens = options.overlapTokens !== undefined ? options.overlapTokens : (env.CHUNK_OVERLAP_TOKENS || 50);

    this.targetChars = targetTokens * CHARS_PER_TOKEN; // default ~2000 chars
    this.overlapChars = overlapTokens * CHARS_PER_TOKEN; // default ~200 chars
  }

  /**
   * Splits arbitrary plain-text content into deterministic, overlapping chunks.
   *
   * @param {string} text - Raw input content
   * @returns {Array<{ chunkIndex: number, content: string, tokenCount: number }>}
   */
  chunkText(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (normalized.length === 0) {
      return [];
    }

    // If total text fits in a single chunk, return immediately
    if (normalized.length <= this.targetChars) {
      return [
        {
          chunkIndex: 0,
          content: normalized,
          tokenCount: estimateTokenCount(normalized),
        },
      ];
    }

    // Split text into semantic segments (paragraphs first, then fallback to lines/sentences)
    const rawSegments = this._splitIntoSegments(normalized);
    const chunks = [];
    let currentChunkText = '';
    let chunkIndex = 0;

    for (let i = 0; i < rawSegments.length; i++) {
      const segment = rawSegments[i];

      if (!currentChunkText) {
        currentChunkText = segment;
        continue;
      }

      // Check if adding this segment would exceed target size
      const separator = currentChunkText.endsWith('\n') ? '' : '\n\n';
      const potentialLength = currentChunkText.length + separator.length + segment.length;

      if (potentialLength <= this.targetChars) {
        currentChunkText += separator + segment;
      } else {
        // Current chunk is full -> commit it
        chunks.push({
          chunkIndex,
          content: currentChunkText.trim(),
          tokenCount: estimateTokenCount(currentChunkText.trim()),
        });
        chunkIndex += 1;

        // Compute overlap prefix from the tail of currentChunkText
        const overlapPrefix = this._computeOverlap(currentChunkText);

        if (overlapPrefix) {
          currentChunkText = overlapPrefix + '\n\n' + segment;
        } else {
          currentChunkText = segment;
        }
      }
    }

    // Flush any remaining accumulated text
    if (currentChunkText.trim()) {
      chunks.push({
        chunkIndex,
        content: currentChunkText.trim(),
        tokenCount: estimateTokenCount(currentChunkText.trim()),
      });
    }

    return chunks;
  }

  /**
   * Splits text into initial paragraph-level segments.
   * Segments larger than targetChars are recursively broken down into sentences or word groups.
   */
  _splitIntoSegments(text) {
    const paragraphs = text.split(/\n{2,}/);
    const segments = [];

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      if (trimmed.length <= this.targetChars) {
        segments.push(trimmed);
      } else {
        // Break large paragraph into smaller pieces (lines or sentences)
        const subPieces = this._breakLargeParagraph(trimmed);
        segments.push(...subPieces);
      }
    }

    return segments;
  }

  /**
   * Breaks an oversized paragraph down by line breaks, sentence endings, or word boundaries.
   */
  _breakLargeParagraph(paragraph) {
    // Try single line breaks first
    const lines = paragraph.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every((l) => l.length <= this.targetChars)) {
      return lines;
    }

    // Try sentence splitting
    const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)/g;
    const sentences = paragraph.match(sentenceRegex) || [paragraph];
    const pieces = [];
    let currentPiece = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if (trimmedSentence.length > this.targetChars) {
        // Sentence itself is larger than targetChars: break by words
        if (currentPiece) {
          pieces.push(currentPiece.trim());
          currentPiece = '';
        }
        const words = trimmedSentence.split(/\s+/);
        let wordGroup = '';
        for (const word of words) {
          if ((wordGroup + ' ' + word).trim().length <= this.targetChars) {
            wordGroup = (wordGroup + ' ' + word).trim();
          } else {
            if (wordGroup) pieces.push(wordGroup);
            wordGroup = word;
          }
        }
        if (wordGroup) pieces.push(wordGroup);
      } else if ((currentPiece + ' ' + trimmedSentence).trim().length <= this.targetChars) {
        currentPiece = (currentPiece + ' ' + trimmedSentence).trim();
      } else {
        if (currentPiece) pieces.push(currentPiece);
        currentPiece = trimmedSentence;
      }
    }

    if (currentPiece) pieces.push(currentPiece);
    return pieces;
  }

  /**
   * Computes an overlap substring from the end of the text preserving word boundaries.
   */
  _computeOverlap(text) {
    if (this.overlapChars <= 0 || text.length <= this.overlapChars) {
      return '';
    }

    const rawSlice = text.slice(-this.overlapChars);
    // Find the first whitespace or punctuation to avoid cutting a word in half
    const firstSpace = rawSlice.search(/\s/);
    if (firstSpace !== -1 && firstSpace < rawSlice.length - 10) {
      return rawSlice.slice(firstSpace + 1).trim();
    }

    return rawSlice.trim();
  }
}

export const chunkingService = new ChunkingService();
