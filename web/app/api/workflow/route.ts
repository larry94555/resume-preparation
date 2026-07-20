import { ingestResume } from "@resume-prep/documents";
import { ingestJobDescription } from "@resume-prep/ingest";
import { importLinkedInProfile } from "@resume-prep/linkedin";
import { runTailoringWorkflow, type TailoringInput } from "@resume-prep/workflow";
import { getClient, getStore, requireModel } from "../../../lib/engine";
import { resolveJobInput, type JobRequest } from "../../../lib/job-input";
import { ndjsonStream } from "../../../lib/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The guided end-to-end flow: resume + job (from URL, saved HTML, or pasted text)
 * + optional LinkedIn profile → review, ATS, fit, cover letter, generated
 * documents, optional LinkedIn change set — all versioned. Streams step-by-step
 * progress so the UI can show a progress bar.
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

  const resumeText = body.resumeText;
  const linkedinText = body.linkedinText;

  return ndjsonStream(async (emit) => {
    emit({
      type: "progress",
      phase: "Reading your résumé",
      done: 0,
      total: 0,
      detail: "Extracting résumé structure with the model (often the slowest step)…",
    });
    const resume = await ingestResume({ format: "text", text: resumeText }, client);

    emit({
      type: "progress",
      phase: "Reading the job description",
      done: 0,
      total: 0,
      detail: `Parsed résumé — ${resume.contact.name}, ${resume.experiences.length} role(s), ${resume.skills.length} skill(s)`,
    });
    const job = await ingestJobDescription(jobInput, client);

    const input: TailoringInput = { resume, job };
    const jobReq = job.requiredSkills.length + job.requiredExperiences.length;
    const jobPref = job.preferredSkills.length + job.preferredExperiences.length;
    const jobDetail = `Parsed job — ${job.title ?? "role"}${job.company ? ` at ${job.company}` : ""}: ${jobReq} required, ${jobPref} preferred`;

    if (linkedinText?.trim()) {
      emit({ type: "progress", phase: "Reading your LinkedIn profile", done: 0, total: 0, detail: jobDetail });
      input.linkedInProfile = await importLinkedInProfile({ format: "text", text: linkedinText }, client);
      emit({ type: "progress", phase: "Starting analysis", done: 0, total: 0, detail: "Parsed your LinkedIn profile" });
    } else {
      emit({ type: "progress", phase: "Starting analysis", done: 0, total: 0, detail: jobDetail });
    }

    const result = await runTailoringWorkflow(input, client, getStore(), (p) =>
      emit({ type: "progress", ...p }),
    );

    const { documents, ...rest } = result;
    emit({
      type: "result",
      result: {
        ...rest,
        documents: {
          resumeDocxBase64: Buffer.from(documents.resumeDocx).toString("base64"),
          coverLetterDocxBase64: Buffer.from(documents.coverLetterDocx).toString("base64"),
        },
      },
    });
  });
}
