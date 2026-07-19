import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import type { ResumeModel } from "@resume-prep/schema";
import { AtsReview } from "@resume-prep/schema";
import { computeAtsSignals, renderAtsSignals } from "./ats-signals.js";
import { renderResumeText } from "./render.js";
import { buildReviewAtsUser, reviewAtsSystem } from "./prompts/review-ats.js";

export interface AtsReviewOptions {
  /**
   * Optional target job description text. When provided, keyword coverage is
   * scored specifically against it; otherwise coverage is assessed generally
   * against the resume's apparent target roles.
   */
  targetJobText?: string;
}

/**
 * Produce an {@link AtsReview}: an ATS-friendliness score, strengths,
 * weaknesses, concrete recommendations, and keyword coverage (requirement 12).
 * Objective structural signals are computed deterministically and fed to the
 * model as ground truth so its judgment is anchored to real facts about the
 * resume.
 */
export function reviewAts(
  resume: ResumeModel,
  client: ChatClient,
  opts: AtsReviewOptions = {},
): Promise<AtsReview> {
  const signals = computeAtsSignals(resume);
  const user = buildReviewAtsUser(
    renderResumeText(resume),
    renderAtsSignals(signals),
    opts.targetJobText,
  );
  return runStructured(client, { system: reviewAtsSystem, user, schema: AtsReview });
}
