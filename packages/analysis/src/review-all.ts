import type { ChatClient } from "@resume-prep/llm";
import type { AtsReview, ResumeModel, ResumeReview } from "@resume-prep/schema";
import { classifyScore, type FitTier } from "@resume-prep/scoring";
import { computeAtsSignals, type AtsSignals } from "./ats-signals.js";
import { reviewAts, type AtsReviewOptions } from "./ats.js";
import { reviewResume } from "./review-resume.js";

/** The complete Phase 2 review output for a resume. */
export interface FullResumeReview {
  review: ResumeReview;
  /** Deterministic tier of `review.overallScore`. */
  reviewTier: FitTier;
  ats: AtsReview;
  /** Deterministic tier of `ats.atsScore`. */
  atsTier: FitTier;
  /** Objective signals that fed the ATS review. */
  signals: AtsSignals;
}

/**
 * Run both the general resume review and the ATS review, returning them
 * together with the deterministic tier classification of each numeric score.
 * The two LLM reviews are independent, so they run concurrently.
 */
export async function reviewAll(
  resume: ResumeModel,
  client: ChatClient,
  opts: AtsReviewOptions = {},
): Promise<FullResumeReview> {
  const signals = computeAtsSignals(resume);
  const [review, ats] = await Promise.all([
    reviewResume(resume, client),
    reviewAts(resume, client, opts),
  ]);
  return {
    review,
    reviewTier: classifyScore(review.overallScore),
    ats,
    atsTier: classifyScore(ats.atsScore),
    signals,
  };
}
