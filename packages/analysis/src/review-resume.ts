import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import type { ResumeModel } from "@resume-prep/schema";
import { ResumeReview } from "@resume-prep/schema";
import { renderResumeText } from "./render.js";
import { buildReviewResumeUser, reviewResumeSystem } from "./prompts/review-resume.js";

/**
 * Produce a general {@link ResumeReview} — strengths, weaknesses, an overall
 * score, and prioritized recommendations — judged against fitting job
 * categories, resume best practices, and anti-filtering strategies
 * (requirement 3). Works with any {@link ChatClient}, so it's testable with a
 * canned fake.
 */
export function reviewResume(
  resume: ResumeModel,
  client: ChatClient,
): Promise<ResumeReview> {
  return runStructured(client, {
    system: reviewResumeSystem,
    user: buildReviewResumeUser(renderResumeText(resume)),
    schema: ResumeReview,
  });
}
