import { z } from "zod";

/** Input file formats the app can ingest. */
export const DocumentFormat = z.enum(["pdf", "docx", "text", "html"]);
export type DocumentFormat = z.infer<typeof DocumentFormat>;

/** What a document represents. */
export const DocumentKind = z.enum(["resume", "cover_letter", "linkedin_profile"]);
export type DocumentKind = z.infer<typeof DocumentKind>;

/**
 * A source document after text extraction but before structuring. `text` is the
 * plain-text content extracted from the original file; `sourcePath` (when set)
 * points at the original on disk for provenance/versioning.
 */
export const SourceDocument = z.object({
  kind: DocumentKind,
  format: DocumentFormat,
  sourcePath: z.string().optional(),
  text: z.string(),
});
export type SourceDocument = z.infer<typeof SourceDocument>;
