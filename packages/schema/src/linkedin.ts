import { z } from "zod";
import { EducationEntry, ExperienceEntry } from "./resume.js";
import { Recommendation } from "./review.js";

/**
 * LinkedIn models (requirements 1 & 2). A profile is imported from a saved PDF
 * export or pasted text; reviewed like a resume; and turned into a change set of
 * copy-paste-ready field rewrites plus step-by-step instructions. Reuses the
 * resume experience/education shapes for consistency.
 */

export const LinkedInProfile = z.object({
  name: z.string().min(1),
  headline: z.string().optional(),
  location: z.string().optional(),
  /** The "About" section. */
  about: z.string().optional(),
  experiences: z.array(ExperienceEntry).default([]),
  education: z.array(EducationEntry).default([]),
  skills: z.array(z.string()).default([]),
});
export type LinkedInProfile = z.infer<typeof LinkedInProfile>;

/** General LinkedIn profile review (requirement 1). */
export const LinkedInReview = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendations: z.array(Recommendation).default([]),
});
export type LinkedInReview = z.infer<typeof LinkedInReview>;

/** A single recommended profile change with copy-paste text and instructions. */
export const LinkedInChange = z.object({
  /** Which profile field, e.g. "headline", "about", "skills", "experience: Acme". */
  field: z.string().min(1),
  /** Current text, if any. */
  current: z.string().optional(),
  /** Copy-paste-ready replacement text. */
  suggested: z.string(),
  /** Where to click / how to apply the change in LinkedIn. */
  instructions: z.string(),
});
export type LinkedInChange = z.infer<typeof LinkedInChange>;

/** A set of recommended LinkedIn changes (requirement 2). */
export const LinkedInChangeSet = z.object({
  summary: z.string(),
  changes: z.array(LinkedInChange).default([]),
});
export type LinkedInChangeSet = z.infer<typeof LinkedInChangeSet>;
