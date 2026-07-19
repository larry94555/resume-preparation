import type { ChatClient } from "@resume-prep/llm";
import type { DocumentFormat, ResumeModel } from "@resume-prep/schema";
import { extractText } from "./extract/index.js";
import { structureResume } from "./structure.js";

export interface IngestResumeInput {
  format: DocumentFormat;
  /** Exactly one source: a file path, raw text, or a binary buffer. */
  path?: string;
  text?: string;
  buffer?: Uint8Array;
}

/**
 * End-to-end resume ingestion: extract text from a PDF/DOCX/text/HTML source,
 * then structure it into a validated {@link ResumeModel}. This is the Phase 1
 * exit path — "given a sample PDF/DOCX resume, produce a validated ResumeModel".
 */
export async function ingestResume(
  input: IngestResumeInput,
  client: ChatClient,
): Promise<ResumeModel> {
  const text = await extractText(input);
  return structureResume(text, client);
}
