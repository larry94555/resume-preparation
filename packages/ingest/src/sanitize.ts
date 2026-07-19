/** Upper bound on untrusted job text sent to the model (chars). */
export const MAX_JOB_TEXT_CHARS = 20000;

/**
 * Prepare untrusted job-description text before it reaches the model. This is a
 * defensive step (DESIGN.md §12): job postings are UNTRUSTED input, so we bound
 * the length (a runaway page can't blow the context or hide a giant injection
 * payload) and collapse whitespace. The primary injection defense is the prompt
 * framing in `extract-job.ts`, which instructs the model to treat this text as
 * data only; this function keeps the payload sane.
 */
export function prepareUntrustedJobText(raw: string): string {
  const collapsed = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (collapsed.length <= MAX_JOB_TEXT_CHARS) return collapsed;
  return `${collapsed.slice(0, MAX_JOB_TEXT_CHARS)}\n[...truncated]`;
}
