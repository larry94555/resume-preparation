import {
  flattenRequirements,
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
/** A step-by-step progress update while the workflow runs. */
export interface TailoringProgress {
  /** Human-readable description of the current step (drives the progress label). */
  phase: string;
  /** Units completed so far (0…total). */
  done: number;
  /** Total units of work. */
  total: number;
  /** Optional detail line about what just finished (for a live activity log). */
  detail?: string;
}

export async function runTailoringWorkflow(
  input: TailoringInput,
  client: ChatClient,
  store: SnapshotStore,
  /** Optional progress callback, invoked as each step starts/finishes. */
  onProgress?: (p: TailoringProgress) => void,
): Promise<TailoringResult> {
  const { resume, job } = input;

  // Total = review + ats + one per requirement + cover letter + doc generation +
  // (LinkedIn review + change set) + versioning.
  const reqCount = flattenRequirements(job).length;
  const total = 2 + reqCount + 1 + 1 + (input.linkedInProfile ? 2 : 0) + 1;
  let done = 0;
  // Each emit carries the label of the step now STARTING plus the detail of what
  // just finished (for the activity log).
  const emit = (phase: string, detail?: string) =>
    onProgress?.({ phase, done, total, ...(detail ? { detail } : {}) });

  emit("Reviewing your résumé");
  const review = await reviewResume(resume, client);
  done++;

  emit("Checking ATS compatibility", `Résumé review: ${review.overallScore}/100 (${classifyScore(review.overallScore)})`);
  const ats = await reviewAts(resume, client, { targetJobText: job.rawText });
  done++;

  emit(`Scoring requirements (0/${reqCount})`, `ATS: ${ats.atsScore}/100 (${classifyScore(ats.atsScore)})`);
  const fit = await matchResumeToJob(resume, job, client, (d, t, match) => {
    done = 2 + d;
    onProgress?.({
      phase: `Scoring requirements (${d}/${t})`,
      done,
      total,
      detail: `${match.label} (${match.importance} ${match.kind}): ${match.score}/100 — ${match.tier}`,
    });
  });
  done = 2 + reqCount;

  emit("Writing your cover letter");
  const coverLetter = await composeCoverLetter(resume, job, client);
  done++;

  emit("Generating documents", `Cover letter drafted (${coverLetter.paragraphs.length} paragraph(s))`);
  const [resumeDocx, coverLetterDocx] = await Promise.all([
    resumeToDocx(resume),
    coverLetterToDocx(coverLetter, `Cover Letter — ${job.title ?? ""}`.trim()),
  ]);
  done++;

  let linkedin: TailoringResult["linkedin"];
  if (input.linkedInProfile) {
    emit("Reviewing your LinkedIn profile", "Generated résumé and cover-letter .docx");
    const liReview = await reviewLinkedIn(input.linkedInProfile, client);
    done++;
    emit("Building your LinkedIn change set", `LinkedIn review: ${liReview.overallScore}/100`);
    const changeSet = await buildLinkedInChangeSet(input.linkedInProfile, client, {
      targetJobText: job.rawText,
    });
    done++;
    linkedin = { review: liReview, changeSet };
    emit("Saving versions", `LinkedIn change set: ${changeSet.changes.length} change(s)`);
  } else {
    emit("Saving versions", "Generated résumé and cover-letter .docx");
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
  done++;
  emit("Done", "All artifacts saved to version history.");

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
