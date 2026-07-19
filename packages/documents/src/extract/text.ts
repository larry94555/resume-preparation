/**
 * Collapse the whitespace noise that PDF/DOCX extraction leaves behind while
 * preserving paragraph and line structure (which the resume-structuring model
 * relies on to tell sections and bullets apart).
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n") // normalize line endings
    .replace(/ /g, " ") // non-breaking spaces → spaces
    .replace(/[ \t]+/g, " ") // runs of spaces/tabs → one space
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // cap blank runs at one blank line
    .trim();
}
