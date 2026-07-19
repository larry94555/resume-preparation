import { z } from "zod";

/**
 * A tailored cover letter (requirement 10). The model composes the greeting,
 * body paragraphs, and closing; rendering to DOCX/PDF is deterministic.
 */
export const CoverLetter = z.object({
  greeting: z.string().optional(),
  /** Body paragraphs in order. */
  paragraphs: z.array(z.string()).default([]),
  closing: z.string().optional(),
});
export type CoverLetter = z.infer<typeof CoverLetter>;
