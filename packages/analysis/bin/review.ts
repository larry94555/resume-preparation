/**
 * Demo CLI: ingest a resume file and print a full review (general + ATS).
 *
 * Usage (from the repo root, with a local model running):
 *   node --env-file=.env --import tsx packages/analysis/bin/review.ts <file> [format] [--json]
 *   # format is one of pdf|docx|text|html; inferred from the extension if omitted.
 *
 * This is a developer/demo tool for the Phase 2 exit criterion ("engine returns
 * a full resume review + ATS review for a sample"); it is not part of the unit
 * test surface. The web UI (later phase) will wrap the same engine functions.
 */
import { basename, extname } from "node:path";
import { ingestResume } from "@resume-prep/documents";
import { LlamaClient } from "@resume-prep/llm";
import type { DocumentFormat } from "@resume-prep/schema";
import type { Recommendation } from "@resume-prep/schema";
import { reviewAll, type FullResumeReview } from "../src/index.js";

function inferFormat(path: string): DocumentFormat {
  const ext = extname(path).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".html" || ext === ".htm") return "html";
  return "text";
}

function printRecommendations(recs: Recommendation[]): void {
  const order = { high: 0, medium: 1, low: 2 } as const;
  for (const r of [...recs].sort((a, b) => order[a.priority] - order[b.priority])) {
    console.log(`  [${r.priority.toUpperCase()}] ${r.title}\n      ${r.rationale}`);
  }
}

function printHuman(full: FullResumeReview): void {
  const { review, reviewTier, ats, atsTier, signals } = full;
  console.log(`\n=== RESUME REVIEW ===`);
  console.log(`Score: ${review.overallScore}/100 (${reviewTier})`);
  console.log(`Target categories: ${review.jobCategories.join(", ") || "—"}`);
  console.log(review.summary);
  console.log(`\nStrengths:`);
  for (const s of review.strengths) console.log(`  + ${s}`);
  console.log(`\nWeaknesses:`);
  for (const w of review.weaknesses) console.log(`  - ${w}`);
  console.log(`\nRecommendations:`);
  printRecommendations(review.recommendations);

  console.log(`\n=== ATS REVIEW ===`);
  console.log(`Score: ${ats.atsScore}/100 (${atsTier})`);
  console.log(ats.summary);
  console.log(`Keywords present: ${ats.keywords.present.join(", ") || "—"}`);
  console.log(`Keywords recommended: ${ats.keywords.recommended.join(", ") || "—"}`);
  console.log(`\nATS recommendations:`);
  printRecommendations(ats.recommendations);

  console.log(`\n=== SIGNALS ===`);
  console.log(
    `bullets: ${signals.bulletCount} (${signals.quantifiedBulletCount} quantified), ` +
      `dated roles: ${signals.datedExperienceCount}/${signals.experienceCount}, ` +
      `empty sections: ${signals.emptySections.join(", ") || "none"}`,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const positional = args.filter((a) => !a.startsWith("--"));
  const path = positional[0];
  if (!path) {
    console.error("usage: review <file> [pdf|docx|text|html] [--json]");
    process.exit(1);
  }
  const format = (positional[1] as DocumentFormat | undefined) ?? inferFormat(path);

  const client = new LlamaClient();
  if (!(await client.health())) {
    console.error(
      "No LLM endpoint reachable. Set LLM_BASE_URL (see .env.example) and start your model server.",
    );
    process.exit(2);
  }

  console.error(`Ingesting ${basename(path)} (${format})...`);
  const resume = await ingestResume({ format, path }, client);
  console.error(`Reviewing...`);
  const full = await reviewAll(resume, client);

  if (asJson) console.log(JSON.stringify(full, null, 2));
  else printHuman(full);
}

await main();
