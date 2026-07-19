import { z } from "zod";

/**
 * Job-description models. `JobExtraction` is exactly what the LLM returns when it
 * reads a (untrusted) job posting; `JobDescription` wraps it with provenance
 * (`source`, `url`, `rawText`) that the app sets — never the model.
 */

/** A job requirement is either a skill/competency or an experience expectation. */
export const JobRequirementKind = z.enum(["skill", "experience"]);
export type JobRequirementKind = z.infer<typeof JobRequirementKind>;

/** Where the job description came from. */
export const JobSource = z.enum(["url", "html", "text"]);
export type JobSource = z.infer<typeof JobSource>;

/** The fields the model extracts from a job posting. */
export const JobExtraction = z.object({
  company: z.string().optional(),
  title: z.string().optional(),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  requiredExperiences: z.array(z.string()).default([]),
  preferredExperiences: z.array(z.string()).default([]),
  /** Special steps to apply (e.g. "include a cover letter", "submit a portfolio"). */
  applicationInstructions: z.array(z.string()).default([]),
});
export type JobExtraction = z.infer<typeof JobExtraction>;

/** A fully-assembled job description: extracted fields plus provenance. */
export const JobDescription = JobExtraction.extend({
  source: JobSource,
  url: z.string().optional(),
  /** The extracted plain text the fields were derived from. */
  rawText: z.string(),
});
export type JobDescription = z.infer<typeof JobDescription>;
