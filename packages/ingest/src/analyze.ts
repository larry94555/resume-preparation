import { htmlToText } from "@resume-prep/documents";
import type { ChatClient } from "@resume-prep/llm";
import { runStructured } from "@resume-prep/llm";
import type { JobDescription, JobExtraction } from "@resume-prep/schema";
import { JobExtraction as JobExtractionSchema } from "@resume-prep/schema";
import { fetchJobHtml, type FetchLike } from "./fetch.js";
import { buildExtractJobUser, extractJobSystem } from "./prompts/extract-job.js";
import { prepareUntrustedJobText } from "./sanitize.js";

/** Extract the structured fields from already-prepared job text. */
export function extractJobFields(
  jobText: string,
  client: ChatClient,
): Promise<JobExtraction> {
  return runStructured(client, {
    system: extractJobSystem,
    user: buildExtractJobUser(jobText),
    schema: JobExtractionSchema,
  });
}

/**
 * Where the job posting comes from. Exactly one of the fields is used:
 * - `url`   → fetched, then HTML-to-text
 * - `html`  → HTML-to-text
 * - `text`  → used as-is (already plain text)
 */
export interface JobInput {
  url?: string;
  html?: string;
  text?: string;
}

export interface IngestJobOptions {
  /** Injectable fetch for testing URL ingestion without the network. */
  fetchImpl?: FetchLike;
}

/**
 * Ingest a job description from a URL, saved HTML, or plain text into a validated
 * {@link JobDescription} (requirement 6). The extracted text is treated as
 * untrusted throughout (bounded + injection-guarded prompt).
 */
export async function ingestJobDescription(
  input: JobInput,
  client: ChatClient,
  opts: IngestJobOptions = {},
): Promise<JobDescription> {
  let source: JobDescription["source"];
  let rawText: string;
  let url: string | undefined;

  if (input.url !== undefined) {
    source = "url";
    url = input.url;
    rawText = htmlToText(await fetchJobHtml(input.url, opts.fetchImpl ?? undefined));
  } else if (input.html !== undefined) {
    source = "html";
    rawText = htmlToText(input.html);
  } else if (input.text !== undefined) {
    source = "text";
    rawText = input.text;
  } else {
    throw new Error("ingestJobDescription: provide one of url, html, or text");
  }

  const prepared = prepareUntrustedJobText(rawText);
  const fields = await extractJobFields(prepared, client);

  return {
    ...fields,
    source,
    ...(url !== undefined ? { url } : {}),
    rawText: prepared,
  };
}
