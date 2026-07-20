// Shared browser-side helpers for the client pages. No Node/engine imports here.

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function downloadBase64(name: string, base64: string, mime: string): void {
  const a = document.createElement("a");
  a.href = `data:${mime};base64,${base64}`;
  a.download = name;
  a.click();
}

export async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}

export interface Progress {
  phase: string;
  done: number;
  total: number;
  /** Optional detail line about what just finished (for the activity log). */
  detail?: string;
}

/**
 * POST `body` to `url` and read the NDJSON progress stream. Calls `onProgress`
 * for each progress event and resolves with the final result payload. Throws if
 * the server returns an error (either an HTTP error before streaming, or an
 * `{ type: "error" }` event during it).
 */
export async function streamJson(
  url: string,
  body: unknown,
  onProgress: (p: Progress) => void,
): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: any;

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed);
    if (event.type === "progress") onProgress(event as Progress);
    else if (event.type === "result") result = event.result;
    else if (event.type === "error") throw new Error(event.error);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    handle(buffer);
  } catch (e) {
    // A read failure means the streaming connection dropped mid-request. Re-throw
    // with a clear, actionable message (the page offers "Try again", which resumes
    // from the on-disk cache).
    const raw = e instanceof Error ? e.message : String(e);
    throw new Error(`connection-lost: the connection to the server dropped mid-request (${raw})`);
  }
  return result;
}

/** Upload a resume/profile file and return its extracted plain text. */
export async function uploadFileText(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/ingest", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Upload failed");
  return data.text as string;
}
