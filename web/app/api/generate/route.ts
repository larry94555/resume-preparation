import { scoreTailoredResume } from "@resume-prep/analysis";
import { composeCoverLetter, coverLetterToDocx, ingestResume, resumeToDocx } from "@resume-prep/documents";
import { ingestJobDescription } from "@resume-prep/ingest";
import { getChat, getClient, getStore, requireModel } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { resumeText, jobText } = (await req.json()) as { resumeText?: string; jobText?: string };
  if (!resumeText?.trim() || !jobText?.trim()) {
    return Response.json({ error: "Paste both your resume and the job description." }, { status: 400 });
  }

  const client = getClient();
  const gate = await requireModel(client);
  if (gate) return gate;
  const chat = getChat(client);

  const resume = await ingestResume({ format: "text", text: resumeText }, chat);
  const job = await ingestJobDescription({ text: jobText }, chat);
  const score = await scoreTailoredResume(resume, job, chat);
  const letter = await composeCoverLetter(resume, job, chat);

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
