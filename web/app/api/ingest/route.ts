import { extractText } from "@resume-prep/documents";
import type { DocumentFormat } from "@resume-prep/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatForName(name: string): DocumentFormat {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".html") || n.endsWith(".htm")) return "html";
  return "text";
}

/** Accept an uploaded resume/profile file and return its extracted plain text. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Upload a file under the 'file' field." }, { status: 400 });
  }
  const format = formatForName(file.name);
  const buffer = new Uint8Array(await file.arrayBuffer());
  try {
    const text = await extractText({ format, buffer });
    return Response.json({ text, format });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not read that file." },
      { status: 422 },
    );
  }
}
