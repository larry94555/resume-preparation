import { ingestResume } from "@resume-prep/documents";
import { ingestJobDescription } from "@resume-prep/ingest";
import { importLinkedInProfile } from "@resume-prep/linkedin";
import { runTailoringWorkflow, type TailoringInput } from "@resume-prep/workflow";
import { getClient, getStore, noModelResponse } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The guided end-to-end flow: resume + job (+ optional LinkedIn profile) →
 * review, ATS, fit, cover letter, generated documents, optional LinkedIn change
 * set — all versioned.
 */
export async function POST(req: Request) {
  const { resumeText, jobText, linkedinText } = (await req.json()) as {
    resumeText?: string;
    jobText?: string;
    linkedinText?: string;
  };
  if (!resumeText?.trim() || !jobText?.trim()) {
    return Response.json({ error: "Paste both your resume and the job description." }, { status: 400 });
  }

  const client = getClient();
  if (!(await client.health())) return noModelResponse();

  const resume = await ingestResume({ format: "text", text: resumeText }, client);
  const job = await ingestJobDescription({ text: jobText }, client);

  const input: TailoringInput = { resume, job };
  if (linkedinText?.trim()) {
    input.linkedInProfile = await importLinkedInProfile({ format: "text", text: linkedinText }, client);
  }

  const result = await runTailoringWorkflow(input, client, getStore());

  // Convert document bytes to base64 for the browser.
  const { documents, ...rest } = result;
  return Response.json({
    ...rest,
    documents: {
      resumeDocxBase64: Buffer.from(documents.resumeDocx).toString("base64"),
      coverLetterDocxBase64: Buffer.from(documents.coverLetterDocx).toString("base64"),
    },
  });
}
