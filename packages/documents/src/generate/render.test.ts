import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOrThrow, ResumeModel } from "@resume-prep/schema";
import { extractDocxText } from "../extract/docx.js";
import { extractPdfText } from "../extract/pdf.js";
import {
  coverLetterToDocx,
  coverLetterToPdf,
  explanationToDocx,
  resumeToDocx,
  resumeToPdf,
  textToDocx,
} from "./index.js";

const RESUME = parseOrThrow(ResumeModel, {
  contact: { name: "Jane Developer", email: "jane@example.com" },
  summary: "Backend engineer with a focus on distributed systems.",
  experiences: [
    { title: "Senior Engineer", organization: "Acme Corp", startDate: "2020", endDate: "Present", bullets: ["Cut latency by 40%"] },
  ],
  skills: ["TypeScript", "Kubernetes"],
});

test("resumeToDocx round-trips through the docx text extractor", async () => {
  const bytes = await resumeToDocx(RESUME);
  assert.ok(bytes.length > 0);
  const text = await extractDocxText(bytes);
  assert.match(text, /Jane Developer/);
  assert.match(text, /Acme Corp/);
  assert.match(text, /Cut latency by 40%/);
  assert.match(text, /TypeScript, Kubernetes/);
});

test("resumeToPdf round-trips through the pdf text extractor", async () => {
  const bytes = await resumeToPdf(RESUME);
  assert.ok(bytes.length > 0);
  const text = await extractPdfText(bytes);
  assert.match(text, /Jane Developer/);
  assert.match(text, /Senior Engineer/);
});

test("resumeToPdf tolerates unicode punctuation and non-encodable glyphs", async () => {
  const fancy = parseOrThrow(ResumeModel, {
    contact: { name: "José “Pepe” Núñez—Dev 🚀" },
    experiences: [{ title: "Engineer", organization: "Acme", bullets: ["Built things — fast • reliably"] }],
  });
  // Should not throw despite smart quotes, em dashes, bullets, and an emoji.
  const bytes = await resumeToPdf(fancy);
  const text = await extractPdfText(bytes);
  assert.match(text, /Engineer/);
});

test("coverLetterToPdf, explanationToDocx, and textToDocx produce readable output", async () => {
  const clPdf = await coverLetterToPdf({ paragraphs: ["Hello from the cover letter."] });
  assert.match(await extractPdfText(clPdf), /Hello from the cover letter/);

  const explain = await explanationToDocx({
    title: "Changes",
    summary: "Tailored to the role.",
    entries: [{ change: "Added Kubernetes", reason: "Required by the job" }],
  });
  assert.match(await extractDocxText(explain), /Added Kubernetes/);

  const doc = await textToDocx("Notes", ["First note.", "Second note."]);
  assert.match(await extractDocxText(doc), /First note\./);
});

test("coverLetterToDocx renders greeting, body, and closing", async () => {
  const bytes = await coverLetterToDocx({
    greeting: "Dear Hiring Team,",
    paragraphs: ["I am excited to apply for the backend role."],
    closing: "Sincerely, Jane",
  });
  const text = await extractDocxText(bytes);
  assert.match(text, /Dear Hiring Team/);
  assert.match(text, /excited to apply/);
  assert.match(text, /Sincerely, Jane/);
});
