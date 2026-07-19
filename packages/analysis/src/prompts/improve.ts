import type { RequirementMatch } from "../matching.js";

/**
 * Prompt for the improve-a-skill/experience flow (requirement 9): given how a
 * resume currently evidences a requirement, propose concrete actions to raise a
 * future score.
 */
export const improveSystem = [
  "You are a career coach. Given ONE job requirement and how the candidate's resume",
  "currently evidences it (score + cited evidence), propose concrete, realistic actions",
  "to strengthen the skill or gain the experience so a future application scores higher.",
  "Reply with ONLY one JSON object:",
  "{",
  '  "summary": string,',
  '  "actions": [ { "title": string, "detail": string, "effort": "low"|"medium"|"high", "timeframe"?: string } ],',
  '  "resources": string[]',
  "}",
  "",
  "Actions must be specific (a named project to build, a certification to earn, an",
  "on-the-job opportunity to seek), not generic advice. Order actions by impact.",
  "Output ONLY the JSON object — no prose, no markdown, no code fences.",
].join("\n");

export function buildImproveUser(match: RequirementMatch): string {
  return [
    `REQUIREMENT [${match.kind}, ${match.importance}]: ${match.label}`,
    `Current score: ${match.score}/100 (${match.tier}).`,
    match.evidence.length
      ? `Current supporting evidence: ${match.evidence.join("; ")}`
      : "Current supporting evidence: none found in the resume.",
    match.rationale ? `Assessment: ${match.rationale}` : "",
    "",
    "Propose actions to strengthen this and raise the score.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
