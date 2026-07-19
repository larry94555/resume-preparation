/**
 * Demo CLI: generate a tailored resume (DOCX + PDF), a cover letter, and an
 * explanation page for a target job — scored and saved to the version store.
 *
 * Usage (from the repo root, with a local model running):
 *   node --env-file=.env --import tsx packages/analysis/bin/generate.ts \
 *     <resumeFile> [format] (--job-url <url> | --job-html <file> | --job-text <file>) \
 *     [--out-dir <dir>] [--data-dir <dir>]
 *
 * Exercises the Phase 5 pieces end to end (generation + scoring + versioning).
 * Developer/demo tool; not part of the unit tests.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import {
  composeCoverLetter,
  coverLetterToDocx,
  explanationToDocx,
  ingestResume,
  resumeToDocx,
  resumeToPdf,
  type ExplanationEntry,
} from "@resume-prep/documents";
import { ingestJobDescription, type JobInput } from "@resume-prep/ingest";
import { LlamaClient } from "@resume-prep/llm";
import type { DocumentFormat } from "@resume-prep/schema";
import { SnapshotStore } from "@resume-prep/versioning";
import { scoreTailoredResume } from "../src/index.js";

function inferFormat(path: string): DocumentFormat {
  const ext = extname(path).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".html" || ext === ".htm") return "html";
  return "text";
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function resolveJobInput(args: string[]): Promise<JobInput> {
  const url = argValue(args, "--job-url");
  if (url) return { url };
  const htmlFile = argValue(args, "--job-html");
  if (htmlFile) return { html: await readFile(htmlFile, "utf8") };
  const textFile = argValue(args, "--job-text");
  if (textFile) return { text: await readFile(textFile, "utf8") };
  throw new Error("provide one of --job-url <url>, --job-html <file>, or --job-text <file>");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flagVals = new Set(
    ["--job-url", "--job-html", "--job-text", "--out-dir", "--data-dir"].flatMap((f) => {
      const v = argValue(args, f);
      return v ? [v] : [];
    }),
  );
  const positional = args.filter((a) => !a.startsWith("--") && !flagVals.has(a));
  const resumePath = positional[0];
  if (!resumePath) {
    console.error(
      "usage: generate <resume> [format] (--job-url <url> | --job-html <file> | --job-text <file>) [--out-dir <dir>] [--data-dir <dir>]",
    );
    process.exit(1);
  }
  const format = (positional[1] as DocumentFormat | undefined) ?? inferFormat(resumePath);
  const outDir = argValue(args, "--out-dir") ?? "out";
  const dataDir = argValue(args, "--data-dir") ?? ".data";

  const client = new LlamaClient();
  if (!(await client.health())) {
    console.error("No LLM endpoint reachable. Set LLM_BASE_URL (see .env.example).");
    process.exit(2);
  }

  console.error(`Ingesting resume ${basename(resumePath)} (${format})...`);
  const resume = await ingestResume({ format, path: resumePath }, client);
  console.error(`Ingesting job description...`);
  const job = await ingestJobDescription(await resolveJobInput(args), client);

  console.error(`Scoring the resume against ${job.title ?? "the role"}...`);
  const score = await scoreTailoredResume(resume, job, client);

  console.error(`Composing cover letter...`);
  const letter = await composeCoverLetter(resume, job, client);

  // Build the explanation page from the fit gaps.
  const entries: ExplanationEntry[] = [
    ...score.missingRequirements.map((r) => ({
      change: `Strengthen coverage of "${r}"`,
      reason: "Required by the job but not yet convincingly evidenced in the resume.",
    })),
    ...score.keywordGaps.map((k) => ({
      change: `Add the keyword "${k}"`,
      reason: "ATS-relevant term for this role that is missing or under-represented.",
    })),
  ];

  await mkdir(outDir, { recursive: true });
  const files: Array<[string, Uint8Array]> = [
    ["tailored-resume.docx", await resumeToDocx(resume)],
    ["tailored-resume.pdf", await resumeToPdf(resume)],
    ["cover-letter.docx", await coverLetterToDocx(letter, `Cover Letter — ${job.title ?? ""}`.trim())],
    [
      "explanation.docx",
      await explanationToDocx({
        title: "Tailoring Guidance",
        summary: `Overall fit ${score.fit.overallScore}/100 — ${score.fit.verdict}.`,
        entries,
      }),
    ],
  ];
  for (const [name, bytes] of files) await writeFile(join(outDir, name), bytes);

  // Version every generated artifact.
  const store = new SnapshotStore({ dir: join(dataDir, "versions") });
  const resumeSnap = await store.save({ target: "resume", kind: "resume", content: resume, source: "generated", note: `tailored for ${job.title ?? "role"}` });
  const letterSnap = await store.save({ target: `cover-letter:${job.company ?? "job"}`, kind: "cover_letter", content: letter, source: "generated" });
  await store.save({ target: `score:${job.title ?? "role"}`, kind: "tailored_score", content: score, source: "generated" });

  console.log(`\n=== TAILORED SCORE ===`);
  console.log(`Overall fit: ${score.fit.overallScore}/100 — ${score.fit.verdict}`);
  console.log(`ATS: ${score.ats.atsScore}/100`);
  console.log(`Covered: ${score.coveredRequirements.join(", ") || "—"}`);
  console.log(`Missing: ${score.missingRequirements.join(", ") || "—"}`);
  console.log(`Keyword matches: ${score.keywordMatches.join(", ") || "—"}`);
  console.log(`Keyword gaps: ${score.keywordGaps.join(", ") || "—"}`);
  console.log(`Clear objective: ${score.hasClearObjective ? "yes" : "no"}`);
  console.log(`\nWrote ${files.length} files to ${outDir}/`);
  console.log(`Versioned snapshots — resume: ${resumeSnap.id}, cover letter: ${letterSnap.id} (in ${join(dataDir, "versions")})`);
}

await main();
