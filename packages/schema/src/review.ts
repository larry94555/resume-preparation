import { z } from "zod";

/**
 * Review models — the structured output of the analysis layer. The LLM produces
 * the free-form judgment (scores, strengths, weaknesses, recommendations); tier
 * classification of the numeric scores is done deterministically elsewhere (see
 * @resume-prep/scoring) so the "why this score" story stays auditable.
 */

/** Priority of a recommended change. */
export const Priority = z.enum(["high", "medium", "low"]);
export type Priority = z.infer<typeof Priority>;

/** A single prioritized, actionable recommendation. */
export const Recommendation = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  priority: Priority,
});
export type Recommendation = z.infer<typeof Recommendation>;

/** General resume review (requirement 3). */
export const ResumeReview = z.object({
  /** 0–100 overall quality score. */
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  /** Job categories the resume appears to target/fit. */
  jobCategories: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendations: z.array(Recommendation).default([]),
});
export type ResumeReview = z.infer<typeof ResumeReview>;

/** Keyword coverage for the ATS review. */
export const AtsKeywordCoverage = z.object({
  /** ATS-relevant keywords/skills clearly present in the resume. */
  present: z.array(z.string()).default([]),
  /** Important keywords for the target roles that are missing/under-represented. */
  recommended: z.array(z.string()).default([]),
});
export type AtsKeywordCoverage = z.infer<typeof AtsKeywordCoverage>;

/** ATS optimization review (requirement 12). */
export const AtsReview = z.object({
  /** 0–100 ATS-friendliness score. */
  atsScore: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendations: z.array(Recommendation).default([]),
  keywords: AtsKeywordCoverage.default({ present: [], recommended: [] }),
});
export type AtsReview = z.infer<typeof AtsReview>;
