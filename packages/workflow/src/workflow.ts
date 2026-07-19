import {
  matchResumeToJob,
  reviewAts,
  reviewResume,
  summarizeCoverage,
  type FitReport,
} from "@resume-prep/analysis";
import {
  composeCoverLetter,
  coverLetterToDocx,
  resumeToDocx,
} from "@resume-prep/documents";
import { buildLinkedInChangeSet, reviewLinkedIn } from "@resume-prep/linkedin";
import type { ChatClient } from "@resume-prep/llm";
import type {
  AtsReview,
  CoverLetter,
  JobDescription,
  LinkedInChangeSet,
  LinkedInProfile,
  LinkedInReview,
  ResumeModel,
  ResumeReview,
} from "@resume-prep/schema";
import { classifyScore, type FitTier } from "@resume-prep/scoring";
import type { SnapshotStore } from "@resume-prep/versioning";

/** Inputs to the full tailoring workflow (resume + job already ingested). */
export interface TailoringInput {
  resume: ResumeModel;
  job: JobDescription;
  /** Optionally include the user's LinkedIn profile to also get a change set. */
  linkedInProfile?: LinkedInProfile;
}

export interface TailoringResult {
  review: ResumeReview;
  reviewTier: FitTier;
  ats: AtsReview;
  atsTier: FitTier;
  fit: FitReport;
  coverage: { covered: string[]; missing: string[] };
  coverLetter: CoverLetter;
  documents: { resumeDocx: Uint8Array; coverLetterDocx: Uint8Array };
  linkedin?: { review: LinkedInReview; changeSet: LinkedInChangeSet };
  versions: {
    resume: string;
    coverLetter: string;
    linkedInChangeSet?: string;
  };
}

/**
 * The end-to-end "target a job" flow as a single engine function (Phase 7):
 * review the resume, score it against the job, draft a cover letter, generate
 * tailored documents, optionally produce a LinkedIn change set, and snapshot the
 * artifacts into the version store. Composes the phase-by-phase pieces, calling
 * each LLM step once. Any {@link ChatClient} works, so the whole pipeline is
 * unit-testable with a single fake.
 */
export async function runTailoringWorkflow(
  input: TailoringInput,
  client: ChatClient,
  store: SnapshotStore,
): Promise<TailoringResult> {
  const { resume, job } = input;

  const review = await reviewResume(resume, client);
  const ats = await reviewAts(resume, client, { targetJobText: job.rawText });
  const fit = await matchResumeToJob(resume, job, client);
  const coverLetter = await composeCoverLetter(resume, job, client);

  const [resumeDocx, coverLetterDocx] = await Promise.all([
    resumeToDocx(resume),
    coverLetterToDocx(coverLetter, `Cover Letter — ${job.title ?? ""}`.trim()),
  ]);

  let linkedin: TailoringResult["linkedin"];
  if (input.linkedInProfile) {
    const [liReview, changeSet] = await Promise.all([
      reviewLinkedIn(input.linkedInProfile, client),
      buildLinkedInChangeSet(input.linkedInProfile, client, { targetJobText: job.rawText }),
    ]);
    linkedin = { review: liReview, changeSet };
  }

  // Version the generated artifacts.
  const resumeSnap = await store.save({
    target: "resume",
    kind: "resume",
    content: resume,
    source: "generated",
    note: `tailored for ${job.title ?? "role"}`,
  });
  const coverSnap = await store.save({
    target: `cover-letter:${job.company ?? "job"}`,
    kind: "cover_letter",
    content: coverLetter,
    source: "generated",
  });
  let linkedInChangeSetId: string | undefined;
  if (linkedin) {
    const liSnap = await store.save({
      target: "linkedin-change-set",
      kind: "linkedin_changeset",
      content: linkedin.changeSet,
      source: "generated",
    });
    linkedInChangeSetId = liSnap.id;
  }

  return {
    review,
    reviewTier: classifyScore(review.overallScore),
    ats,
    atsTier: classifyScore(ats.atsScore),
    fit,
    coverage: summarizeCoverage(fit.matches),
    coverLetter,
    documents: { resumeDocx, coverLetterDocx },
    ...(linkedin ? { linkedin } : {}),
    versions: {
      resume: resumeSnap.id,
      coverLetter: coverSnap.id,
      ...(linkedInChangeSetId ? { linkedInChangeSet: linkedInChangeSetId } : {}),
    },
  };
}
