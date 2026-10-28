export type TextSegment = { type: 'text'; value: string } | { type: 'link'; value: string; href: string };

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/**
 * Splits chat text into plain text and http(s) links. Rendering the segments as React nodes
 * keeps user input escaped; no HTML is ever injected.
 */
export function splitLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const value = match[0].replace(TRAILING_PUNCTUATION, '');
    if (value.length === 0) continue;

    if (start > cursor) segments.push({ type: 'text', value: text.slice(cursor, start) });
    segments.push({ type: 'link', value, href: value });
    cursor = start + value.length;
  }

  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });
  return segments;
}
