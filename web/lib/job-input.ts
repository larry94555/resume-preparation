import type { JobInput } from "@resume-prep/ingest";

/**
 * The three ways the UI can supply a job description: a posting **URL**, the text
 * of a **saved HTML** page, or **pasted plain text**. Whichever is non-empty wins,
 * in that order.
 */
export interface JobRequest {
  jobUrl?: string;
  jobHtml?: string;
  jobText?: string;
}

/** Build the engine's {@link JobInput} from a request, or null if none is given. */
export function resolveJobInput(body: JobRequest): JobInput | null {
  if (body.jobUrl?.trim()) return { url: body.jobUrl.trim() };
  if (body.jobHtml?.trim()) return { html: body.jobHtml };
  if (body.jobText?.trim()) return { text: body.jobText };
  return null;
}
