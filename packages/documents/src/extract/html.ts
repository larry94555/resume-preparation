import { normalizeWhitespace } from "./text.js";

/**
 * Extract readable text from an HTML document without a heavyweight DOM library.
 * Drops script/style content, turns block-level tags into line breaks, decodes
 * the common named/numeric entities, and normalizes whitespace. Good enough for
 * a saved resume/profile page or (later) a saved job-description page.
 *
 * NOTE: this only extracts text — it never executes or interprets the HTML. Any
 * instruction-like text inside a fetched page is treated strictly as data by the
 * analysis layer (see DESIGN.md §12).
 */
export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const withBreaks = withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer)\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ");

  const stripped = withBreaks.replace(/<[^>]+>/g, " ");

  const decoded = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));

  return normalizeWhitespace(decoded);
}
