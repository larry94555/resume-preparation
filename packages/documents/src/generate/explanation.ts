import type { Block } from "./blocks.js";

/** One documented change and the reason for it. */
export interface ExplanationEntry {
  change: string;
  reason: string;
}

export interface ExplanationInput {
  title?: string;
  summary?: string;
  entries: ExplanationEntry[];
}

/**
 * Build the "what changed and why" explanation page (requirement 10) as blocks.
 * Deterministic: the caller supplies the changes (e.g. mapped from a version
 * diff) and their rationales; this lays them out consistently.
 */
export function explanationToBlocks(input: ExplanationInput): Block[] {
  const blocks: Block[] = [{ type: "title", text: input.title ?? "Summary of Changes" }];
  if (input.summary) blocks.push({ type: "text", text: input.summary });

  if (input.entries.length === 0) {
    blocks.push({ type: "text", text: "No changes were made." });
    return blocks;
  }

  blocks.push({ type: "heading", text: "Changes" });
  for (const e of input.entries) {
    blocks.push({ type: "bullet", text: `${e.change} — why: ${e.reason}` });
  }
  return blocks;
}
