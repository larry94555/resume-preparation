import { extractText } from "@resume-prep/documents";
import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import type { DocumentFormat, LinkedInProfile, LinkedInReview } from "@resume-prep/schema";
import { LinkedInProfile as LinkedInProfileSchema, LinkedInReview as LinkedInReviewSchema } from "@resume-prep/schema";
import { renderLinkedInText } from "./render.js";
import {
  buildReviewProfileUser,
  buildStructureProfileUser,
  reviewProfileSystem,
  structureProfileSystem,
} from "./prompts.js";

/** Structure already-extracted profile text into a {@link LinkedInProfile}. */
export function structureLinkedInProfile(
  profileText: string,
  client: ChatClient,
): Promise<LinkedInProfile> {
  return runStructured(client, {
    system: structureProfileSystem,
    user: buildStructureProfileUser(profileText),
    schema: LinkedInProfileSchema,
  });
}

export interface ImportLinkedInInput {
  /** "pdf" for a saved profile export, or "text" for pasted profile text. */
  format: DocumentFormat;
  path?: string;
  text?: string;
  buffer?: Uint8Array;
}

/**
 * Import a LinkedIn profile from a saved PDF export or pasted text into a
 * validated {@link LinkedInProfile} (requirement 1). Mirrors resume ingestion.
 */
export async function importLinkedInProfile(
  input: ImportLinkedInInput,
  client: ChatClient,
): Promise<LinkedInProfile> {
  const text = await extractText(input);
  return structureLinkedInProfile(text, client);
}

/** Review a LinkedIn profile: strengths, weaknesses, score, recommendations. */
export function reviewLinkedIn(
  profile: LinkedInProfile,
  client: ChatClient,
): Promise<LinkedInReview> {
  return runStructured(client, {
    system: reviewProfileSystem,
    user: buildReviewProfileUser(renderLinkedInText(profile)),
    schema: LinkedInReviewSchema,
  });
}
