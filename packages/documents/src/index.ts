export {
  extractText,
  extractDocxText,
  extractPdfText,
  htmlToText,
  normalizeWhitespace,
} from "./extract/index.js";
export type { ExtractInput } from "./extract/index.js";
export { structureResume } from "./structure.js";
export { ingestResume } from "./ingest.js";
export type { IngestResumeInput } from "./ingest.js";
export {
  structureResumeSystem,
  buildStructureResumeUser,
} from "./prompts/structure-resume.js";
export {
  resumeToDocx,
  resumeToPdf,
  coverLetterToDocx,
  coverLetterToPdf,
  explanationToDocx,
  textToDocx,
  resumeToBlocks,
  coverLetterToBlocks,
  textToBlocks,
  blocksToPlainText,
  blocksToDocx,
  blocksToPdf,
  explanationToBlocks,
  composeCoverLetter,
  composeCoverLetterSystem,
  buildComposeCoverLetterUser,
} from "./generate/index.js";
export type { Block, ExplanationEntry, ExplanationInput } from "./generate/index.js";
