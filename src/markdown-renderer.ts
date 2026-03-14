// ── Lightweight Markdown → HTML renderer with DOMPurify sanitization ──
// Handles: bold, italic, code, code blocks, links, lists, line breaks

import DOMPurify from 'dompurify';

// Configure DOMPurify: allow safe HTML subset for chat messages
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'code', 'pre', 'a',
    'ul', 'ol', 'li', 'blockquote',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

/** Convert basic markdown to sanitized HTML */
export function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = escapeHtml(text);

  // Code blocks: ```lang\n...\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre><code>${code.trim()}</code></pre>`
  );

  // Inline code: `...`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold: **...**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *...*
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Links: [text](url) — only http/https
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Unordered lists: - item
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists: 1. item
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Line breaks (double newline = paragraph, single = br)
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph if not already wrapped in a block element
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  // Sanitize final output with DOMPurify
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
