/**
 * Demo CLI for LinkedIn review and change-set generation (requirements 1 & 2).
 *
 * Usage (from the repo root, with a local model running):
 *   node --env-file=.env --import tsx packages/linkedin/bin/linkedin.ts \
 *     review   <profileFile> [pdf|text] [--json]
 *   node --env-file=.env --import tsx packages/linkedin/bin/linkedin.ts \
 *     changeset <profileFile> [pdf|text] [--job-text <file>] [--json]
 *
 * The safe, ToS-compliant path: it prints a scored review and copy-paste-ready
 * changes with instructions. Assisted browser fill is intentionally NOT wired
 * into this CLI. Developer/demo tool; not part of the unit tests.
 */
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { LlamaClient } from "@resume-prep/llm";
import type { DocumentFormat } from "@resume-prep/schema";
import { buildLinkedInChangeSet, importLinkedInProfile, reviewLinkedIn } from "../src/index.js";

function inferFormat(path: string): DocumentFormat {
  return extname(path).toLowerCase() === ".pdf" ? "pdf" : "text";
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (mode !== "review" && mode !== "changeset") {
    console.error("usage: linkedin review|changeset <profileFile> [pdf|text] [--job-text <file>] [--json]");
    process.exit(1);
  }
  const asJson = args.includes("--json");
  const jobTextFile = argValue(args, "--job-text");
  const positional = args.slice(1).filter((a) => !a.startsWith("--") && a !== jobTextFile);
  const profilePath = positional[0];
  if (!profilePath) {
    console.error("usage: linkedin review|changeset <profileFile> [pdf|text] [--job-text <file>] [--json]");
    process.exit(1);
  }
  const format = (positional[1] as DocumentFormat | undefined) ?? inferFormat(profilePath);

  const client = new LlamaClient();
  if (!(await client.health())) {
    console.error("No LLM endpoint reachable. Set LLM_BASE_URL (see .env.example).");
    process.exit(2);
  }

  console.error(`Importing profile ${basename(profilePath)} (${format})...`);
  const profile = await importLinkedInProfile({ format, path: profilePath }, client);

  if (mode === "review") {
    const review = await reviewLinkedIn(profile, client);
    if (asJson) return void console.log(JSON.stringify(review, null, 2));
    console.log(`\n=== LINKEDIN REVIEW ===\nScore: ${review.overallScore}/100\n${review.summary}`);
    console.log(`\nStrengths:`);
    for (const s of review.strengths) console.log(`  + ${s}`);
    console.log(`\nWeaknesses:`);
    for (const w of review.weaknesses) console.log(`  - ${w}`);
    console.log(`\nRecommendations:`);
    for (const r of review.recommendations) console.log(`  [${r.priority}] ${r.title} — ${r.rationale}`);
    return;
  }

  const targetJobText = jobTextFile ? await readFile(jobTextFile, "utf8") : undefined;
  const changeSet = await buildLinkedInChangeSet(profile, client, targetJobText ? { targetJobText } : {});
  if (asJson) return void console.log(JSON.stringify(changeSet, null, 2));
  console.log(`\n=== LINKEDIN CHANGE SET ===\n${changeSet.summary}\n`);
  for (const c of changeSet.changes) {
    console.log(`● ${c.field}`);
    if (c.current) console.log(`   current:   ${c.current}`);
    console.log(`   suggested: ${c.suggested}`);
    console.log(`   how:       ${c.instructions}\n`);
  }
}

await main();
