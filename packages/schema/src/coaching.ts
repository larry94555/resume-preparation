import { z } from "zod";

/**
 * Coaching models — the structured outputs of the interactive challenge-a-score
 * and improve-a-skill flows (requirements 8 & 9). As elsewhere, the LLM produces
 * these payloads; the session state machine and score deltas around them are
 * deterministic (see @resume-prep/analysis challenge/improve).
 */

/** Clarifying questions the coach asks to surface concrete evidence. */
export const ChallengeQuestions = z.object({
  questions: z.array(z.string()).default([]),
});
export type ChallengeQuestions = z.infer<typeof ChallengeQuestions>;

/** The coach's verdict on candidate-provided evidence for one requirement. */
export const EvidenceEvaluation = z.object({
  /** Does the evidence genuinely demonstrate the requirement? */
  credible: z.boolean(),
  /** Why the evidence is or isn't credible. */
  reasoning: z.string(),
  /** When not credible: the specific evidence still needed. */
  missing: z.array(z.string()).default([]),
  /** When credible: a concise, quantified resume bullet capturing the evidence. */
  suggestedResumeBullet: z.string().optional(),
  /** When credible: text to add to the LinkedIn profile. */
  suggestedLinkedInText: z.string().optional(),
});
export type EvidenceEvaluation = z.infer<typeof EvidenceEvaluation>;

/** Effort level of an improvement action. */
export const ImprovementEffort = z.enum(["low", "medium", "high"]);
export type ImprovementEffort = z.infer<typeof ImprovementEffort>;

export const ImprovementAction = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  effort: ImprovementEffort,
  /** Rough time to complete, e.g. "1 weekend", "3 months". */
  timeframe: z.string().optional(),
});
export type ImprovementAction = z.infer<typeof ImprovementAction>;

/** A plan to strengthen a skill or gain an experience (requirement 9). */
export const ImprovementPlan = z.object({
  summary: z.string(),
  actions: z.array(ImprovementAction).default([]),
  resources: z.array(z.string()).default([]),
});
export type ImprovementPlan = z.infer<typeof ImprovementPlan>;
