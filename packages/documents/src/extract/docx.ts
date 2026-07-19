import mammoth from "mammoth";
import { normalizeWhitespace } from "./text.js";

/**
 * Extract plain text from a .docx file's bytes using mammoth. We take the raw
 * text (not mammoth's HTML) because the structuring model only needs the words,
 * and raw text sidesteps style-markup noise.
 */
export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return normalizeWhitespace(result.value);
}
