import type { ChatClient } from "@resume-prep/llm";
import type { AtsReview, JobDescription, ResumeModel } from "@resume-prep/schema";
import { reviewAts } from "./ats.js";
import { matchResumeToJob, type FitReport, type RequirementMatch } from "./matching.js";

/**
 * Split scored requirements into those the resume clearly covers (strong or
 * reasonable) and those it does not. Pure/deterministic.
 */
export function summarizeCoverage(matches: RequirementMatch[]): {
  covered: string[];
  missing: string[];
} {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const m of matches) {
    if (m.tier === "strong" || m.tier === "reasonable") covered.push(m.label);
    else missing.push(m.label);
  }
  return { covered, missing };
}

/**
 * Scorecard for an updated/tailored resume against a target job (requirement 11):
 * how it fits per-requirement, which keywords match, which skills/experiences are
 * covered, whether it states a clear objective, and ATS best-practice findings.
 * Reuses the Phase 2 ATS review and Phase 3 matching engine.
 */
export interface TailoredScore {
  /** Per-requirement fit against the job (keywords/skills/experiences covered). */
  fit: FitReport;
  /** ATS review (best practices + keyword coverage) against the same job. */
  ats: AtsReview;
  /** Requirements the resume clearly covers. */
  coveredRequirements: string[];
  /** Requirements the resume does not yet convincingly cover. */
  missingRequirements: string[];
  /** ATS-relevant keywords found in the resume. */
  keywordMatches: string[];
  /** Important keywords still missing/under-represented. */
  keywordGaps: string[];
  /** Whether the resume states a clear objective/summary (deterministic check). */
  hasClearObjective: boolean;
}

export async function scoreTailoredResume(
  resume: ResumeModel,
  job: JobDescription,
  client: ChatClient,
): Promise<TailoredScore> {
  const [fit, ats] = await Promise.all([
    matchResumeToJob(resume, job, client),
    reviewAts(resume, client, { targetJobText: job.rawText }),
  ]);

  const { covered, missing } = summarizeCoverage(fit.matches);

  return {
    fit,
    ats,
    coveredRequirements: covered,
    missingRequirements: missing,
    keywordMatches: ats.keywords.present,
    keywordGaps: ats.keywords.recommended,
    hasClearObjective: Boolean(resume.summary && resume.summary.trim()),
  };
}
