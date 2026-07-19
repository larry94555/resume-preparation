import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import { ResumeModel } from "@resume-prep/schema";
import { buildStructureResumeUser, structureResumeSystem } from "./prompts/structure-resume.js";

/**
 * Turn extracted resume text into a validated {@link ResumeModel}. The heavy
 * lifting is the LLM structuring pass; validation/normalization (array defaults,
 * shape enforcement) is handled by the schema inside {@link runStructured}. Any
 * {@link ChatClient} works, so this is unit-testable with a canned fake.
 */
export function structureResume(
  resumeText: string,
  client: ChatClient,
): Promise<ResumeModel> {
  return runStructured(client, {
    system: structureResumeSystem,
    user: buildStructureResumeUser(resumeText),
    schema: ResumeModel,
  });
}
