import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import { normalizeWhitespace } from "./text.js";

/**
 * Extract plain text from a PDF's bytes using unpdf (a serverless build of
 * pdf.js). Pages are merged into one text blob, then whitespace-normalized.
 * Scanned/image-only PDFs yield little or no text — OCR is out of scope for now.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // pdf.js (via unpdf) rejects a Node Buffer even though it subclasses
  // Uint8Array, so copy into a plain Uint8Array before handing it over.
  const data = new Uint8Array(bytes);
  const pdf = await getDocumentProxy(data);
  const { text } = await unpdfExtractText(pdf, { mergePages: true });
  return normalizeWhitespace(text);
}
