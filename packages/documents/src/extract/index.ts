import { readFile } from "node:fs/promises";
import type { DocumentFormat } from "@resume-prep/schema";
import { extractDocxText } from "./docx.js";
import { htmlToText } from "./html.js";
import { extractPdfText } from "./pdf.js";
import { normalizeWhitespace } from "./text.js";

/**
 * A document to extract text from. Exactly one of `text`, `buffer`, or `path`
 * must be supplied; `format` selects the extractor.
 */
export interface ExtractInput {
  format: DocumentFormat;
  path?: string;
  text?: string;
  buffer?: Uint8Array;
}

async function loadText(input: ExtractInput): Promise<string> {
  if (input.text !== undefined) return input.text;
  if (input.buffer !== undefined) return Buffer.from(input.buffer).toString("utf8");
  if (input.path !== undefined) return readFile(input.path, "utf8");
  throw new Error("extract: no source provided (expected text, buffer, or path)");
}

async function loadBytes(input: ExtractInput): Promise<Uint8Array> {
  if (input.buffer !== undefined) return input.buffer;
  if (input.path !== undefined) return readFile(input.path);
  if (input.text !== undefined) return new TextEncoder().encode(input.text);
  throw new Error("extract: no source provided (expected buffer, path, or text)");
}

/** Extract normalized plain text from a document according to its format. */
export async function extractText(input: ExtractInput): Promise<string> {
  switch (input.format) {
    case "text":
      return normalizeWhitespace(await loadText(input));
    case "html":
      return htmlToText(await loadText(input));
    case "pdf":
      return extractPdfText(await loadBytes(input));
    case "docx":
      return extractDocxText(await loadBytes(input));
    default: {
      const exhaustive: never = input.format;
      throw new Error(`extract: unsupported format ${String(exhaustive)}`);
    }
  }
}

export { extractDocxText, extractPdfText, htmlToText, normalizeWhitespace };
