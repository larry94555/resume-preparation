import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import { ChallengeQuestions, EvidenceEvaluation } from "@resume-prep/schema";
import type { FitTier } from "@resume-prep/scoring";
import type { RequirementInput, RequirementMatch } from "./matching.js";
import { scoreRequirement } from "./matching.js";
import {
  buildChallengeQuestionsUser,
  buildEvaluateEvidenceUser,
  challengeQuestionsSystem,
  evaluateEvidenceSystem,
} from "./prompts/challenge.js";

export type ChallengeStatus = "awaiting_evidence" | "accepted" | "insufficient";

/** Result of re-scoring a requirement after accepting new evidence. */
export interface RescoreResult {
  match: RequirementMatch;
  /** newScore − originalScore. */
  delta: number;
  improved: boolean;
}

/**
 * A serializable record of a score challenge — the requirement, the original
 * score, the coach's questions, the candidate's evidence, the verdict, and any
 * re-score. Plain data so Phase 5 can snapshot it into the version store.
 */
export interface ChallengeSession {
  requirement: RequirementInput;
  originalScore: number;
  originalTier: FitTier;
  questions: string[];
  status: ChallengeStatus;
  evidence?: string;
  evaluation?: EvidenceEvaluation;
  rescore?: RescoreResult;
}

export type ChallengeEvent =
  | { type: "questions"; questions: string[] }
  | { type: "evidence"; text: string }
  | { type: "evaluation"; evaluation: EvidenceEvaluation; rescore?: RescoreResult };

/** Start a challenge session from an existing requirement match. */
export function startChallengeSession(match: RequirementMatch): ChallengeSession {
  return {
    requirement: { label: match.label, kind: match.kind, importance: match.importance },
    originalScore: match.score,
    originalTier: match.tier,
    questions: [],
    status: "awaiting_evidence",
  };
}

/**
 * Pure reducer advancing a challenge session. Deterministic and side-effect free:
 * the LLM steps produce the event payloads; this decides the resulting state.
 */
export function challengeReducer(
  state: ChallengeSession,
  event: ChallengeEvent,
): ChallengeSession {
  if (event.type === "questions") {
    return { ...state, questions: event.questions, status: "awaiting_evidence" };
  }
  if (event.type === "evidence") {
    return { ...state, evidence: event.text };
  }
  // event.type === "evaluation"
  const status: ChallengeStatus = event.evaluation.credible ? "accepted" : "insufficient";
  return {
    ...state,
    evaluation: event.evaluation,
    status,
    ...(event.rescore ? { rescore: event.rescore } : {}),
  };
}

/**
 * Append candidate-provided evidence to the resume text for re-scoring, clearly
 * labeled as pending (not yet part of the official resume). Deterministic.
 */
export function augmentResumeWithEvidence(
  resumeText: string,
  evidence: string,
  suggestedBullet?: string,
): string {
  const parts = [
    resumeText,
    "",
    "ADDITIONAL EVIDENCE (candidate-provided, pending resume update):",
    evidence.trim(),
  ];
  if (suggestedBullet && suggestedBullet.trim()) {
    parts.push(`Suggested bullet: ${suggestedBullet.trim()}`);
  }
  return parts.join("\n");
}

/** Ask the coach for clarifying questions to surface evidence. */
export async function askChallengeQuestions(
  requirement: RequirementInput,
  originalScore: number,
  resumeText: string,
  client: ChatClient,
): Promise<string[]> {
  const out = await runStructured(client, {
    system: challengeQuestionsSystem,
    user: buildChallengeQuestionsUser(requirement, originalScore, resumeText),
    schema: ChallengeQuestions,
  });
  return out.questions;
}

/** Evaluate candidate-provided evidence against the requirement. */
export function evaluateEvidence(
  requirement: RequirementInput,
  originalScore: number,
  resumeText: string,
  userEvidence: string,
  client: ChatClient,
): Promise<EvidenceEvaluation> {
  return runStructured(client, {
    system: evaluateEvidenceSystem,
    user: buildEvaluateEvidenceUser(requirement, originalScore, resumeText, userEvidence),
    schema: EvidenceEvaluation,
  });
}

/**
 * Submit the candidate's evidence for a challenge: evaluate it and, if credible,
 * re-score the requirement with the evidence folded in and compute the delta.
 * Returns the advanced session (status `accepted` or `insufficient`).
 */
export async function submitChallengeEvidence(
  session: ChallengeSession,
  userEvidence: string,
  resumeText: string,
  client: ChatClient,
): Promise<ChallengeSession> {
  const withEvidence = challengeReducer(session, { type: "evidence", text: userEvidence });

  const evaluation = await evaluateEvidence(
    session.requirement,
    session.originalScore,
    resumeText,
    userEvidence,
    client,
  );

  let rescore: RescoreResult | undefined;
  if (evaluation.credible) {
    const augmented = augmentResumeWithEvidence(
      resumeText,
      userEvidence,
      evaluation.suggestedResumeBullet,
    );
    const match = await scoreRequirement(session.requirement, augmented, client);
    rescore = {
      match,
      delta: match.score - session.originalScore,
      improved: match.score > session.originalScore,
    };
  }

  return challengeReducer(withEvidence, {
    type: "evaluation",
    evaluation,
    ...(rescore ? { rescore } : {}),
  });
}
