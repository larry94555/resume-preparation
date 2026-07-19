import { matchResumeToJob, reviewAll } from "@resume-prep/analysis";
import { ingestResume } from "@resume-prep/documents";
import { ingestJobDescription } from "@resume-prep/ingest";
import { getClient, noModelResponse } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { resumeText, jobText } = (await req.json()) as { resumeText?: string; jobText?: string };
  if (!resumeText?.trim()) {
    return Response.json({ error: "Paste your resume text first." }, { status: 400 });
  }

  const client = getClient();
  if (!(await client.health())) return noModelResponse();

  const resume = await ingestResume({ format: "text", text: resumeText }, client);
  const reviews = await reviewAll(resume, client);

  let fit = null;
  let job = null;
  if (jobText?.trim()) {
    job = await ingestJobDescription({ text: jobText }, client);
    fit = await matchResumeToJob(resume, job, client);
  }

  return Response.json({ resume, reviews, job, fit });
}
