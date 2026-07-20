import { matchResumeToJob, reviewAll } from "@resume-prep/analysis";
import { ingestResume } from "@resume-prep/documents";
import { ingestJobDescription } from "@resume-prep/ingest";
import { getClient, noModelResponse } from "../../../lib/engine";
import { resolveJobInput, type JobRequest } from "../../../lib/job-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as JobRequest & { resumeText?: string };
  if (!body.resumeText?.trim()) {
    return Response.json({ error: "Paste your resume text first." }, { status: 400 });
  }

  const client = getClient();
  if (!(await client.health())) return noModelResponse();

  const resume = await ingestResume({ format: "text", text: body.resumeText }, client);
  const reviews = await reviewAll(resume, client);

  // A job (from URL, saved HTML, or pasted text) is optional for a plain review.
  const jobInput = resolveJobInput(body);
  let fit = null;
  let job = null;
  if (jobInput) {
    job = await ingestJobDescription(jobInput, client);
    fit = await matchResumeToJob(resume, job, client);
  }

  return Response.json({ resume, reviews, job, fit });
}
