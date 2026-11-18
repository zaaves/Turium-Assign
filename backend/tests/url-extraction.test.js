import { describe, it, expect } from 'vitest';
import { extractTextFromHtml } from '../src/services/url-extraction.service.js';

describe('HTML Text Extraction', () => {
  it('should extract title and clean content while removing scripts, styles, and navigation', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>React Documentation - Getting Started</title>
          <style>body { color: red; }</style>
          <script>console.log("analytics tracking");</script>
        </head>
        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/docs">Docs</a>
          </nav>
          <header>
            <h1>Header Banner</h1>
          </header>
          <main>
            <h1>Getting Started with React</h1>
            <p>React is a JavaScript library for building user interfaces.</p>
            <p>It lets you compose complex UIs from small and isolated pieces of code called components.</p>
          </main>
          <aside>
            <p>Advertisement sidebar</p>
          </aside>
          <footer>
            <p>&copy; 2026 Meta Platforms, Inc.</p>
          </footer>
        </body>
      </html>
    `;

    const result = extractTextFromHtml(html);

    expect(result.title).toBe('React Documentation - Getting Started');
    expect(result.rawContent).toContain('React is a JavaScript library for building user interfaces.');
    expect(result.rawContent).toContain('pieces of code called components.');

    // Verifying noise removal
    expect(result.rawContent).not.toContain('analytics tracking');
    expect(result.rawContent).not.toContain('color: red');
    expect(result.rawContent).not.toContain('Advertisement sidebar');
    expect(result.rawContent).not.toContain('Meta Platforms');
    expect(result.rawContent).not.toContain('Header Banner');
  });

  it('should fallback to og:title when <title> tag is missing', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Open Graph Title Preview" />
        </head>
        <body>
          <p>Some meaningful body text content for this webpage test case.</p>
        </body>
      </html>
    `;

    const result = extractTextFromHtml(html);
    expect(result.title).toBe('Open Graph Title Preview');
    expect(result.rawContent).toContain('Some meaningful body text');
  });

  it('should fallback to default title if neither <title> nor og:title exist', () => {
    const html = `
      <html>
        <body>
          <p>Content without any document title defined anywhere.</p>
        </body>
      </html>
    `;

    const result = extractTextFromHtml(html, 'Fallback Domain Title');
    expect(result.title).toBe('Fallback Domain Title');
  });
});
