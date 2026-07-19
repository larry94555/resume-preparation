import type { Importance } from "@resume-prep/scoring";
import type { JobRequirementKind } from "@resume-prep/schema";

/**
 * Prompt for scoring ONE job requirement against a resume — the narrow,
 * evidence-grounded judgment described in DESIGN.md §5/§6. Requiring cited
 * evidence is what makes the resulting score auditable and challengeable.
 */
export const scoreRequirementSystem = [
  "You assess how well a candidate's resume evidences ONE specific job requirement.",
  "Reply with ONLY one JSON object: { \"score\": number, \"evidence\": string[], \"rationale\": string }.",
  "",
  "score (0-100): how strongly the resume DEMONSTRATES this requirement.",
  "  85-100 strong/direct evidence; 70-84 reasonable; 50-69 weak;",
  "  30-49 very weak; below 30 little or no evidence.",
  "evidence: short specifics or near-quotes taken FROM THE RESUME that justify the",
  "  score. If the resume shows nothing relevant, return an empty array.",
  "rationale: one or two sentences explaining the score, grounded in the evidence.",
  "",
  "Only credit skills/experiences actually present in the resume. No evidence ⇒ low",
  "score. Do not assume unstated abilities.",
  "Output ONLY the JSON object — no prose, no markdown, no code fences.",
].join("\n");

export function buildScoreRequirementUser(
  requirement: { label: string; kind: JobRequirementKind; importance: Importance },
  resumeText: string,
): string {
  return [
    `REQUIREMENT [${requirement.kind}, ${requirement.importance}]: ${requirement.label}`,
    "",
    "Score how well the resume below evidences that requirement.",
    "",
    "--- RESUME START ---",
    resumeText,
    "--- RESUME END ---",
  ].join("\n");
}
