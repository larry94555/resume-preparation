import { matchResumeToJob, reviewAll } from "@resume-prep/analysis";
import { ingestResume } from "@resume-prep/documents";
import { ingestJobDescription } from "@resume-prep/ingest";
import { getClient, requireModel } from "../../../lib/engine";
import { resolveJobInput, type JobRequest } from "../../../lib/job-input";
import { ndjsonStream } from "../../../lib/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as JobRequest & { resumeText?: string };
  if (!body.resumeText?.trim()) {
    return Response.json({ error: "Paste your resume text first." }, { status: 400 });
  }

  const client = getClient();
  const gate = await requireModel(client);
  if (gate) return gate;

  const resumeText = body.resumeText;
  const jobInput = resolveJobInput(body);

  // Stream progress: ingest + review run as labeled (indeterminate) phases; the
  // per-requirement scoring drives a determinate bar.
  return ndjsonStream(async (emit) => {
    emit({
      type: "progress",
      phase: "Reading your résumé",
      done: 0,
      total: 0,
      detail: "Extracting résumé structure with the model (often the slowest step)…",
    });
    const resume = await ingestResume({ format: "text", text: resumeText }, client);
    const resumeDetail = `Parsed résumé — ${resume.contact.name}, ${resume.experiences.length} role(s), ${resume.skills.length} skill(s)`;

    let job = null;
    if (jobInput) {
      emit({ type: "progress", phase: "Reading the job description", done: 0, total: 0, detail: resumeDetail });
      job = await ingestJobDescription(jobInput, client);
      const req = job.requiredSkills.length + job.requiredExperiences.length;
      const pref = job.preferredSkills.length + job.preferredExperiences.length;
      emit({
        type: "progress",
        phase: "Reviewing your résumé and ATS",
        done: 0,
        total: 0,
        detail: `Parsed job — ${job.title ?? "role"}${job.company ? ` at ${job.company}` : ""}: ${req} required, ${pref} preferred`,
      });
    } else {
      emit({ type: "progress", phase: "Reviewing your résumé and ATS", done: 0, total: 0, detail: resumeDetail });
    }

    const reviews = await reviewAll(resume, client);

    let fit = null;
    if (job) {
      emit({
        type: "progress",
        phase: "Scoring requirements",
        done: 0,
        total: 0,
        detail: `Résumé review: ${reviews.review.overallScore}/100 (${reviews.reviewTier}); ATS: ${reviews.ats.atsScore}/100 (${reviews.atsTier})`,
      });
      fit = await matchResumeToJob(resume, job, client, (done, total, match) =>
        emit({
          type: "progress",
          phase: `Scoring requirements (${done}/${total})`,
          done,
          total,
          detail: `${match.label} (${match.importance} ${match.kind}): ${match.score}/100 — ${match.tier}`,
        }),
      );
    }

    emit({ type: "result", result: { resume, reviews, job, fit } });
  });
}
