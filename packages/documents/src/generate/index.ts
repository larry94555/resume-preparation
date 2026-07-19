import type { CoverLetter, ResumeModel } from "@resume-prep/schema";
import { coverLetterToBlocks, resumeToBlocks, textToBlocks } from "./blocks.js";
import { blocksToDocx } from "./docx.js";
import { blocksToPdf } from "./pdf.js";
import { explanationToBlocks, type ExplanationInput } from "./explanation.js";

/** Generate an ATS-friendly resume as .docx bytes. */
export function resumeToDocx(resume: ResumeModel): Promise<Uint8Array> {
  return blocksToDocx(resumeToBlocks(resume));
}

/** Generate an ATS-friendly resume as .pdf bytes. */
export function resumeToPdf(resume: ResumeModel): Promise<Uint8Array> {
  return blocksToPdf(resumeToBlocks(resume));
}

/** Generate a cover letter as .docx bytes. */
export function coverLetterToDocx(letter: CoverLetter, title?: string): Promise<Uint8Array> {
  return blocksToDocx(coverLetterToBlocks(letter, title));
}

/** Generate a cover letter as .pdf bytes. */
export function coverLetterToPdf(letter: CoverLetter, title?: string): Promise<Uint8Array> {
  return blocksToPdf(coverLetterToBlocks(letter, title));
}

/** Generate the explanation page as .docx bytes. */
export function explanationToDocx(input: ExplanationInput): Promise<Uint8Array> {
  return blocksToDocx(explanationToBlocks(input));
}

/** Generate a titled plain document as .docx bytes. */
export function textToDocx(title: string, paragraphs: string[]): Promise<Uint8Array> {
  return blocksToDocx(textToBlocks(title, paragraphs));
}

export {
  resumeToBlocks,
  coverLetterToBlocks,
  textToBlocks,
  blocksToPlainText,
} from "./blocks.js";
export type { Block } from "./blocks.js";
export { blocksToDocx } from "./docx.js";
export { blocksToPdf } from "./pdf.js";
export { explanationToBlocks } from "./explanation.js";
export type { ExplanationEntry, ExplanationInput } from "./explanation.js";
export {
  composeCoverLetter,
  composeCoverLetterSystem,
  buildComposeCoverLetterUser,
} from "./cover-letter.js";
