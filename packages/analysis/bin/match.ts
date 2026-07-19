/**
 * Demo CLI: score a resume against a job description and print the fit report.
 *
 * Usage (from the repo root, with a local model running):
 *   node --env-file=.env --import tsx packages/analysis/bin/match.ts \
 *     <resumeFile> [resumeFormat] (--job-url <url> | --job-html <file> | --job-text <file>) [--json]
 *
 * Satisfies the Phase 3 exit criterion — "paste a JD → get per-item scores + an
 * explained overall verdict." Developer/demo tool; not part of the unit tests.
 */
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { ingestResume } from "@resume-prep/documents";
import { ingestJobDescription, type JobInput } from "@resume-prep/ingest";
import { LlamaClient } from "@resume-prep/llm";
import type { DocumentFormat } from "@resume-prep/schema";
import { matchResumeToJob, type FitReport } from "../src/index.js";

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

function printReport(report: FitReport): void {
  console.log(`\n=== FIT REPORT ===`);
  console.log(`Overall: ${report.overallScore}/100 — ${report.verdict} (${report.overallTier})`);
  const c = report.tierCounts;
  console.log(
    `Tiers — strong: ${c.strong}, reasonable: ${c.reasonable}, weak: ${c.weak}, ` +
      `very weak: ${c.very_weak}, stretch: ${c.stretch}`,
  );

  console.log(`\nPer-requirement scores:`);
  for (const m of report.matches) {
    console.log(`  ${m.score.toString().padStart(3)}  [${m.tier}] (${m.importance} ${m.kind}) ${m.label}`);
    if (m.evidence.length) console.log(`        evidence: ${m.evidence.join("; ")}`);
    if (m.rationale) console.log(`        ${m.rationale}`);
  }

  if (report.criticalGaps.length) {
    console.log(`\nCritical gaps (required + a stretch):`);
    for (const g of report.criticalGaps) console.log(`  - ${g.label} (${g.score}/100)`);
  } else {
    console.log(`\nNo critical gaps.`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const positional = args.filter((a, i) => {
    if (a.startsWith("--")) return false;
    const prev = args[i - 1];
    return !(prev === "--job-url" || prev === "--job-html" || prev === "--job-text");
  });
  const resumePath = positional[0];
  if (!resumePath) {
    console.error(
      "usage: match <resumeFile> [format] (--job-url <url> | --job-html <file> | --job-text <file>) [--json]",
    );
    process.exit(1);
  }
  const format = (positional[1] as DocumentFormat | undefined) ?? inferFormat(resumePath);

  const client = new LlamaClient();
  if (!(await client.health())) {
    console.error("No LLM endpoint reachable. Set LLM_BASE_URL (see .env.example).");
    process.exit(2);
  }

  console.error(`Ingesting resume ${basename(resumePath)} (${format})...`);
  const resume = await ingestResume({ format, path: resumePath }, client);
  console.error(`Ingesting job description...`);
  const job = await ingestJobDescription(await resolveJobInput(args), client);
  console.error(`Scoring ${job.title ?? "the role"} against the resume...`);
  const report = await matchResumeToJob(resume, job, client);

  if (asJson) console.log(JSON.stringify({ job, report }, null, 2));
  else printReport(report);
}

await main();
