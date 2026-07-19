import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import type { JobDescription, JobRequirementKind, ResumeModel } from "@resume-prep/schema";
import { MatchAssessment } from "@resume-prep/schema";
import {
  classifyScore,
  describeFit,
  isStretch,
  summarizeFit,
  type FitTier,
  type Importance,
  type ScoredItem,
} from "@resume-prep/scoring";
import { renderResumeText } from "./render.js";
import {
  buildScoreRequirementUser,
  scoreRequirementSystem,
} from "./prompts/score-requirement.js";

/** One flattened job requirement to be scored. */
export interface RequirementInput {
  label: string;
  kind: JobRequirementKind;
  importance: Importance;
}

/** A requirement plus its scored, evidence-grounded assessment and derived tier. */
export interface RequirementMatch extends RequirementInput {
  score: number;
  evidence: string[];
  rationale: string;
  tier: FitTier;
}

/** The overall fit of a resume to a job (requirement 7). */
export interface FitReport {
  overallScore: number;
  overallTier: FitTier;
  /** User-facing phrasing of the overall tier (e.g. "a strong fit", "a stretch"). */
  verdict: string;
  tierCounts: Record<FitTier, number>;
  /** Required requirements that scored as a stretch — the application's biggest risks. */
  criticalGaps: RequirementMatch[];
  matches: RequirementMatch[];
}

/** Flatten a job's four requirement lists into a single scored-in-order list. */
export function flattenRequirements(job: JobDescription): RequirementInput[] {
  const reqs: RequirementInput[] = [];
  const push = (labels: string[], kind: JobRequirementKind, importance: Importance) => {
    for (const label of labels) reqs.push({ label, kind, importance });
  };
  push(job.requiredSkills, "skill", "required");
  push(job.requiredExperiences, "experience", "required");
  push(job.preferredSkills, "skill", "preferred");
  push(job.preferredExperiences, "experience", "preferred");
  return reqs;
}

/**
 * Assemble a {@link FitReport} from already-scored matches. Deterministic: the
 * overall score/tier/verdict/counts come from @resume-prep/scoring (required
 * items weighted above preferred), and critical gaps are the required matches
 * that land in a stretch tier.
 */
export function buildFitReport(matches: RequirementMatch[]): FitReport {
  const scored: ScoredItem[] = matches.map((m) => ({
    label: m.label,
    score: m.score,
    importance: m.importance,
  }));
  const summary = summarizeFit(scored);
  const criticalGaps = matches.filter((m) => m.importance === "required" && isStretch(m.tier));

  return {
    overallScore: summary.overallScore,
    overallTier: summary.overallTier,
    verdict: describeFit(summary.overallTier),
    tierCounts: summary.tierCounts,
    criticalGaps,
    matches,
  };
}

/** Score a single requirement against the rendered resume text. */
export async function scoreRequirement(
  requirement: RequirementInput,
  resumeText: string,
  client: ChatClient,
): Promise<RequirementMatch> {
  const assessment = await runStructured(client, {
    system: scoreRequirementSystem,
    user: buildScoreRequirementUser(requirement, resumeText),
    schema: MatchAssessment,
  });
  return {
    ...requirement,
    score: assessment.score,
    evidence: assessment.evidence,
    rationale: assessment.rationale,
    tier: classifyScore(assessment.score),
  };
}

/**
 * Score a resume against every requirement in a job description and aggregate
 * into a {@link FitReport} (requirements 6→7). Requirements are scored one at a
 * time — a narrow judgment per item is more reliable on small local models and
 * respects the single-slot (deterministic) server.
 */
export async function matchResumeToJob(
  resume: ResumeModel,
  job: JobDescription,
  client: ChatClient,
): Promise<FitReport> {
  const resumeText = renderResumeText(resume);
  const requirements = flattenRequirements(job);
  const matches: RequirementMatch[] = [];
  for (const req of requirements) {
    matches.push(await scoreRequirement(req, resumeText, client));
  }
  return buildFitReport(matches);
}
