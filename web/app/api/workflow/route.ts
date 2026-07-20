import { ingestResume } from "@resume-prep/documents";
import { ingestJobDescription } from "@resume-prep/ingest";
import { importLinkedInProfile } from "@resume-prep/linkedin";
import { runTailoringWorkflow, type TailoringInput } from "@resume-prep/workflow";
import { getClient, getStore, requireModel } from "../../../lib/engine";
import { resolveJobInput, type JobRequest } from "../../../lib/job-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The guided end-to-end flow: resume + job (from URL, saved HTML, or pasted text)
 * + optional LinkedIn profile → review, ATS, fit, cover letter, generated
 * documents, optional LinkedIn change set — all versioned.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as JobRequest & { resumeText?: string; linkedinText?: string };
  const jobInput = resolveJobInput(body);
  if (!body.resumeText?.trim() || !jobInput) {
    return Response.json(
      { error: "Provide your resume and a job description (URL, saved HTML, or pasted text)." },
      { status: 400 },
    );
  }

  const client = getClient();
  const gate = await requireModel(client);
  if (gate) return gate;

  const resume = await ingestResume({ format: "text", text: body.resumeText }, client);
  const job = await ingestJobDescription(jobInput, client);

  const input: TailoringInput = { resume, job };
  if (body.linkedinText?.trim()) {
    input.linkedInProfile = await importLinkedInProfile({ format: "text", text: body.linkedinText }, client);
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
