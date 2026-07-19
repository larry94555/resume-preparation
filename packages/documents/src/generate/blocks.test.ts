import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOrThrow, ResumeModel } from "@resume-prep/schema";
import { blocksToPlainText, coverLetterToBlocks, resumeToBlocks, textToBlocks } from "./blocks.js";
import { explanationToBlocks } from "./explanation.js";

const RESUME = parseOrThrow(ResumeModel, {
  contact: { name: "Jane Developer", email: "jane@example.com", links: ["linkedin.com/in/jane"] },
  summary: "Backend engineer.",
  experiences: [
    { title: "Senior Engineer", organization: "Acme", startDate: "2020", endDate: "Present", bullets: ["Cut latency 40%"] },
  ],
  skills: ["TypeScript", "Node.js"],
});

test("resumeToBlocks emits a title, contact subtitle, headings, and bullets", () => {
  const blocks = resumeToBlocks(RESUME);
  assert.equal(blocks[0]?.type, "title");
  assert.equal(blocks[0]?.text, "Jane Developer");
  assert.equal(blocks[1]?.type, "subtitle");
  assert.match(blocks[1]?.text ?? "", /jane@example\.com \| linkedin\.com\/in\/jane/);
  assert.ok(blocks.some((b) => b.type === "heading" && b.text === "Experience"));
  assert.ok(blocks.some((b) => b.type === "bullet" && b.text === "Cut latency 40%"));
  assert.ok(blocks.some((b) => b.type === "heading" && b.text === "Skills"));
});

test("resumeToBlocks renders education, certifications, and projects sections", () => {
  const full = parseOrThrow(ResumeModel, {
    contact: { name: "Jane Developer" },
    education: [{ degree: "BS", field: "CS", institution: "State U", endDate: "2016", details: ["GPA 3.9"] }],
    certifications: [{ name: "AWS SA", issuer: "Amazon", date: "2022" }],
    projects: [{ name: "Scheduler", description: "OSS job runner", bullets: ["10k stars"], link: "github.com/j/s" }],
  });
  const blocks = resumeToBlocks(full);
  assert.ok(blocks.some((b) => b.type === "heading" && b.text === "Education"));
  assert.ok(blocks.some((b) => b.text === "BS, CS — State U (2016)"));
  assert.ok(blocks.some((b) => b.type === "bullet" && b.text === "GPA 3.9"));
  assert.ok(blocks.some((b) => b.type === "heading" && b.text === "Certifications"));
  assert.ok(blocks.some((b) => b.text === "AWS SA — Amazon — 2022"));
  assert.ok(blocks.some((b) => b.type === "heading" && b.text === "Projects"));
  assert.ok(blocks.some((b) => b.text === "Scheduler — OSS job runner"));
  assert.ok(blocks.some((b) => b.text === "github.com/j/s"));
});

test("blocksToPlainText upper-cases headings and prefixes bullets", () => {
  const text = blocksToPlainText(resumeToBlocks(RESUME));
  assert.match(text, /EXPERIENCE/);
  assert.match(text, /- Cut latency 40%/);
});

test("textToBlocks and coverLetterToBlocks produce a leading title", () => {
  assert.equal(textToBlocks("Notes", ["a", "b"])[0]?.type, "title");
  const cl = coverLetterToBlocks({ greeting: "Dear team,", paragraphs: ["I am excited."], closing: "Sincerely, Jane" });
  assert.equal(cl[0]?.text, "Cover Letter");
  assert.ok(cl.some((b) => b.text === "Dear team,"));
});

test("explanationToBlocks lists changes with reasons, and handles the empty case", () => {
  const blocks = explanationToBlocks({
    title: "Tailoring changes",
    summary: "Aligned the resume to the job.",
    entries: [{ change: "Added Kubernetes to skills", reason: "Job requires it and you have evidence" }],
  });
  assert.equal(blocks[0]?.text, "Tailoring changes");
  assert.ok(blocks.some((b) => b.type === "bullet" && /Kubernetes.*why:/.test(b.text)));

  const empty = explanationToBlocks({ entries: [] });
  assert.ok(empty.some((b) => b.text === "No changes were made."));
});
