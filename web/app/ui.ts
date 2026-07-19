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

/** Upload a resume/profile file and return its extracted plain text. */
export async function uploadFileText(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/ingest", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Upload failed");
  return data.text as string;
}
