import { scoreTailoredResume } from "@resume-prep/analysis";
import { composeCoverLetter, coverLetterToDocx, ingestResume, resumeToDocx } from "@resume-prep/documents";
import { ingestJobDescription } from "@resume-prep/ingest";
import { getClient, getStore, noModelResponse } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { resumeText, jobText } = (await req.json()) as { resumeText?: string; jobText?: string };
  if (!resumeText?.trim() || !jobText?.trim()) {
    return Response.json({ error: "Paste both your resume and the job description." }, { status: 400 });
  }

  const client = getClient();
  if (!(await client.health())) return noModelResponse();

  const resume = await ingestResume({ format: "text", text: resumeText }, client);
  const job = await ingestJobDescription({ text: jobText }, client);
  const score = await scoreTailoredResume(resume, job, client);
  const letter = await composeCoverLetter(resume, job, client);

  const [resumeDocx, coverDocx] = await Promise.all([resumeToDocx(resume), coverLetterToDocx(letter)]);

  const store = getStore();
  const resumeSnap = await store.save({ target: "resume", kind: "resume", content: resume, source: "generated", note: `tailored for ${job.title ?? "role"}` });
  const coverSnap = await store.save({ target: `cover-letter:${job.company ?? "job"}`, kind: "cover_letter", content: letter, source: "generated" });

  return Response.json({
    score,
    resumeDocxBase64: Buffer.from(resumeDocx).toString("base64"),
    coverDocxBase64: Buffer.from(coverDocx).toString("base64"),
    versions: { resume: resumeSnap.id, cover: coverSnap.id },
  });
}
