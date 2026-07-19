import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import type { LinkedInChangeSet, LinkedInProfile } from "@resume-prep/schema";
import { LinkedInChangeSet as LinkedInChangeSetSchema } from "@resume-prep/schema";
import { renderLinkedInText } from "./render.js";
import { buildChangeSetUser, changeSetSystem } from "./prompts.js";

export interface ChangeSetOptions {
  /** Optional target job description to tailor the rewrites toward. */
  targetJobText?: string;
}

/**
 * Produce a {@link LinkedInChangeSet} — copy-paste-ready field rewrites plus
 * step-by-step update instructions (requirement 2). Optionally tailored to a
 * target job. This is the safe, ToS-compliant path (no automation).
 */
export function buildLinkedInChangeSet(
  profile: LinkedInProfile,
  client: ChatClient,
  opts: ChangeSetOptions = {},
): Promise<LinkedInChangeSet> {
  return runStructured(client, {
    system: changeSetSystem,
    user: buildChangeSetUser(renderLinkedInText(profile), opts.targetJobText),
    schema: LinkedInChangeSetSchema,
  });
}
