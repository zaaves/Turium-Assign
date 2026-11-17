import * as cheerio from 'cheerio';
import { validateAndResolveUrl } from '../utils/safe-url.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const MAX_REDIRECTS = 5;

/**
 * Normalizes extracted text by collapsing multiple whitespace characters and blank lines.
 */
function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Extracts title and clean readable text from HTML markup using Cheerio.
 */
export function extractTextFromHtml(html, fallbackTitle = 'Untitled Web Page') {
  const $ = cheerio.load(html);

  // Remove non-content and noisy elements
  $(
    'script, style, noscript, nav, footer, header, aside, form, svg, iframe, select, button, [aria-hidden="true"]'
  ).remove();

  // Extract title
  let title = $('title').first().text().trim();
  if (!title) {
    title = $('meta[property="og:title"]').attr('content')?.trim() || '';
  }
  if (!title) {
    title = $('meta[name="twitter:title"]').attr('content')?.trim() || '';
  }
  if (!title) {
    title = $('h1').first().text().trim() || fallbackTitle;
  }

  // Extract main readable content
  let bodyText = '';
  const mainContent = $('main, article, #content, .content, #main, .main');
  if (mainContent.length > 0) {
    bodyText = mainContent.text();
  } else {
    bodyText = $('body').text();
  }

  const rawContent = normalizeText(bodyText);

  return {
    title: title || fallbackTitle,
    rawContent,
  };
}

/**
 * Fetches a URL with SSRF protection, redirect verification, size limits, and timeouts.
 */
export async function fetchAndExtractUrl(initialUrlString) {
  let currentUrl = initialUrlString;
  let redirectCount = 0;

  while (redirectCount <= MAX_REDIRECTS) {
    // 1. SSRF & DNS validation on the target URL
    const { url: validatedUrl } = await validateAndResolveUrl(currentUrl);

    // 2. Setup timeout signal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.URL_FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(validatedUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'TuriumAI-KnowledgeInbox/1.0 (+http://localhost)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual', // Enforce manual redirect inspection for SSRF
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`URL fetch timed out after ${env.URL_FETCH_TIMEOUT_MS}ms.`);
      }
      throw new Error(`Network error while fetching URL: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    // 3. Handle redirects manually
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`Received HTTP ${response.status} redirect without a Location header.`);
      }

      redirectCount += 1;
      if (redirectCount > MAX_REDIRECTS) {
        throw new Error(`Exceeded maximum redirect limit of ${MAX_REDIRECTS}.`);
      }

      // Resolve relative redirect URLs against the current URL
      currentUrl = new URL(location, currentUrl).toString();
      logger.info({ redirectCount, nextUrl: currentUrl }, 'Following HTTP redirect');
      continue;
    }

    if (!response.ok) {
      throw new Error(`Remote server responded with HTTP status ${response.status} (${response.statusText}).`);
    }

    // 4. Validate Content-Type
    const contentType = response.headers.get('content-type') || '';
    const isHtml =
      contentType.includes('text/html') ||
      contentType.includes('application/xhtml+xml');

    if (!isHtml) {
      throw new Error(
        `Unsupported content type '${contentType}'. Only HTML pages (text/html) are supported for URL ingestion.`
      );
    }

    // 5. Check Content-Length if present
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > env.MAX_INGEST_BYTES) {
      throw new Error(
        `Remote content size (${contentLength} bytes) exceeds maximum permitted size of ${env.MAX_INGEST_BYTES} bytes.`
      );
    }

    // 6. Read response body with size guard
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > env.MAX_INGEST_BYTES) {
      throw new Error(
        `Downloaded content size (${arrayBuffer.byteLength} bytes) exceeds maximum permitted size of ${env.MAX_INGEST_BYTES} bytes.`
      );
    }

    const html = new TextDecoder('utf-8').decode(arrayBuffer);

    // 7. Extract text and title
    const fallbackTitle = validatedUrl.hostname + (validatedUrl.pathname !== '/' ? validatedUrl.pathname : '');
    const { title, rawContent } = extractTextFromHtml(html, fallbackTitle);

    if (!rawContent || rawContent.length < 10) {
      throw new Error('Extracted web page content was empty or insufficient for indexing.');
    }

    return {
      title,
      rawContent,
      finalUrl: currentUrl,
    };
  }

  throw new Error(`Exceeded maximum redirect limit of ${MAX_REDIRECTS}.`);
}
