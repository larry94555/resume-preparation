import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import type { JobDescription, ResumeModel } from "@resume-prep/schema";
import { CoverLetter } from "@resume-prep/schema";
import { blocksToPlainText, resumeToBlocks } from "./blocks.js";

export const composeCoverLetterSystem = [
  "You write a concise, tailored cover letter for a candidate applying to a specific job.",
  "Reply with ONLY one JSON object:",
  '{ "greeting"?: string, "paragraphs": string[], "closing"?: string }',
  "",
  "- 3-4 short body paragraphs: a hook, why the candidate fits (cite concrete resume",
  "  evidence relevant to the job's requirements), and a close.",
  "- Ground every claim in the resume. Do NOT invent experience the candidate lacks.",
  "- Professional, specific, no clichés or filler.",
  "Output ONLY the JSON object — no prose, no markdown, no code fences.",
].join("\n");

export function buildComposeCoverLetterUser(resume: ResumeModel, job: JobDescription): string {
  const jobBits = [
    job.title ? `Title: ${job.title}` : "",
    job.company ? `Company: ${job.company}` : "",
    job.requiredSkills.length ? `Required skills: ${job.requiredSkills.join(", ")}` : "",
    job.requiredExperiences.length ? `Required experience: ${job.requiredExperiences.join(", ")}` : "",
    job.preferredSkills.length ? `Preferred skills: ${job.preferredSkills.join(", ")}` : "",
  ].filter(Boolean);

  return [
    "TARGET JOB:",
    ...jobBits,
    "",
    "CANDIDATE RESUME:",
    blocksToPlainText(resumeToBlocks(resume)),
    "",
    "Write the tailored cover letter now.",
  ].join("\n");
}

/**
 * Compose a tailored {@link CoverLetter} from a resume and a target job
 * description (requirement 10). LLM-backed; testable with a fake client.
 */
export function composeCoverLetter(
  resume: ResumeModel,
  job: JobDescription,
  client: ChatClient,
): Promise<CoverLetter> {
  return runStructured(client, {
    system: composeCoverLetterSystem,
    user: buildComposeCoverLetterUser(resume, job),
    schema: CoverLetter,
  });
}
