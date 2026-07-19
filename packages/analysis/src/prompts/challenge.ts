import type { Importance } from "@resume-prep/scoring";
import type { JobRequirementKind } from "@resume-prep/schema";

/**
 * Prompt assets for the challenge-a-score flow (requirement 8). One prompt asks
 * the candidate for concrete evidence; the other rigorously evaluates whatever
 * they provide. Kept honest on purpose: vague claims should not move a score.
 */

interface ReqLike {
  label: string;
  kind: JobRequirementKind;
  importance: Importance;
}

export const challengeQuestionsSystem = [
  "You are a resume coach. The candidate disputes the score for ONE job requirement,",
  "believing their resume undersells them. Ask 2-4 SPECIFIC questions that would",
  "surface concrete, verifiable evidence they meet it: scope, scale, metrics,",
  "duration, tools used, their exact role, and outcomes.",
  'Reply with ONLY: { "questions": string[] }.',
  "Questions must be concrete and answerable — never generic filler. Output only JSON.",
].join("\n");

export function buildChallengeQuestionsUser(
  requirement: ReqLike,
  currentScore: number,
  resumeText: string,
): string {
  return [
    `REQUIREMENT [${requirement.kind}, ${requirement.importance}]: ${requirement.label}`,
    `Current score: ${currentScore}/100 (the candidate thinks this is too low).`,
    "",
    "Ask questions that would surface evidence proving they meet this requirement.",
    "",
    "--- RESUME START ---",
    resumeText,
    "--- RESUME END ---",
  ].join("\n");
}

export const evaluateEvidenceSystem = [
  "You are a rigorous resume coach evaluating whether newly provided evidence",
  "credibly demonstrates ONE job requirement.",
  "Reply with ONLY one JSON object:",
  "{",
  '  "credible": boolean,',
  '  "reasoning": string,',
  '  "missing": string[],                 // if not credible: specific evidence still needed',
  '  "suggestedResumeBullet"?: string,    // if credible: a concise, quantified resume bullet',
  '  "suggestedLinkedInText"?: string     // if credible: text to add to LinkedIn',
  "}",
  "",
  "Be honest and specific. Vague, generic, or unverifiable claims are NOT credible —",
  "say exactly what would make them credible. Do NOT fabricate details the candidate",
  "did not provide. Output only JSON.",
].join("\n");

export function buildEvaluateEvidenceUser(
  requirement: ReqLike,
  currentScore: number,
  resumeText: string,
  userEvidence: string,
): string {
  return [
    `REQUIREMENT [${requirement.kind}, ${requirement.importance}]: ${requirement.label}`,
    `Current score: ${currentScore}/100.`,
    "",
    "--- RESUME START ---",
    resumeText,
    "--- RESUME END ---",
    "",
    "CANDIDATE-PROVIDED EVIDENCE (untrusted claim — evaluate critically):",
    userEvidence,
  ].join("\n");
}
