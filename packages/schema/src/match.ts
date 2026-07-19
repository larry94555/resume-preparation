import { z } from "zod";

/**
 * The model's assessment of how well a resume evidences ONE job requirement.
 * `score` is graded deterministically into a fit tier elsewhere (see
 * @resume-prep/scoring); `evidence` is the resume text the model relied on, which
 * powers the "why this score" drill-down and the Phase 4 challenge flow.
 */
export const MatchAssessment = z.object({
  /** 0–100: how strongly the resume demonstrates this requirement. */
  score: z.number().min(0).max(100),
  /** Specific resume snippets that justify the score; empty when there is none. */
  evidence: z.array(z.string()).default([]),
  /** One or two sentences explaining the score, grounded in the evidence. */
  rationale: z.string(),
});
export type MatchAssessment = z.infer<typeof MatchAssessment>;
