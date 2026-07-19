/**
 * Demo CLI for the interactive coaching flows (requirements 8 & 9).
 *
 * Usage (from the repo root, with a local model running):
 *   node --env-file=.env --import tsx packages/analysis/bin/coach.ts \
 *     challenge <resumeFile> [format] --requirement "<label>" \
 *       [--kind skill|experience] [--importance required|preferred] [--evidence "<text>"]
 *   node --env-file=.env --import tsx packages/analysis/bin/coach.ts \
 *     improve <resumeFile> [format] --requirement "<label>" [--kind ...] [--importance ...]
 *
 * Satisfies the Phase 4 exit criterion — dispute a score and get a reasoned,
 * evidence-based response. Developer/demo tool; not part of the unit tests.
 */
import { basename, extname } from "node:path";
import { ingestResume } from "@resume-prep/documents";
import { LlamaClient } from "@resume-prep/llm";
import type { DocumentFormat, JobRequirementKind } from "@resume-prep/schema";
import type { Importance } from "@resume-prep/scoring";
import {
  askChallengeQuestions,
  challengeReducer,
  planImprovement,
  renderResumeText,
  scoreRequirement,
  startChallengeSession,
  submitChallengeEvidence,
  type RequirementInput,
} from "../src/index.js";

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

function usage(): never {
  console.error(
    "usage:\n" +
      '  coach challenge <resume> [format] --requirement "<label>" [--kind skill|experience] [--importance required|preferred] [--evidence "<text>"]\n' +
      '  coach improve   <resume> [format] --requirement "<label>" [--kind skill|experience] [--importance required|preferred]',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (mode !== "challenge" && mode !== "improve") usage();

  const flagValues = new Set(
    ["--requirement", "--kind", "--importance", "--evidence"].flatMap((f) => {
      const v = argValue(args, f);
      return v ? [v] : [];
    }),
  );
  const positional = args.slice(1).filter((a) => !a.startsWith("--") && !flagValues.has(a));
  const resumePath = positional[0];
  const label = argValue(args, "--requirement");
  if (!resumePath || !label) usage();

  const format = (positional[1] as DocumentFormat | undefined) ?? inferFormat(resumePath);
  const requirement: RequirementInput = {
    label,
    kind: (argValue(args, "--kind") as JobRequirementKind | undefined) ?? "skill",
    importance: (argValue(args, "--importance") as Importance | undefined) ?? "required",
  };

  const client = new LlamaClient();
  if (!(await client.health())) {
    console.error("No LLM endpoint reachable. Set LLM_BASE_URL (see .env.example).");
    process.exit(2);
  }

  console.error(`Ingesting resume ${basename(resumePath)} (${format})...`);
  const resume = await ingestResume({ format, path: resumePath }, client);
  const resumeText = renderResumeText(resume);

  console.error(`Scoring "${requirement.label}"...`);
  const match = await scoreRequirement(requirement, resumeText, client);
  console.log(`\nCurrent score for "${match.label}": ${match.score}/100 (${match.tier})`);
  if (match.evidence.length) console.log(`Evidence: ${match.evidence.join("; ")}`);
  console.log(match.rationale);

  if (mode === "improve") {
    console.error(`\nBuilding improvement plan...`);
    const plan = await planImprovement(match, client);
    console.log(`\n=== IMPROVEMENT PLAN ===\n${plan.summary}`);
    for (const a of plan.actions) {
      console.log(`  [${a.effort}${a.timeframe ? `, ${a.timeframe}` : ""}] ${a.title}\n      ${a.detail}`);
    }
    if (plan.resources.length) console.log(`Resources: ${plan.resources.join(", ")}`);
    return;
  }

  // challenge mode
  let session = startChallengeSession(match);
  console.error(`\nAsking clarifying questions...`);
  const questions = await askChallengeQuestions(requirement, match.score, resumeText, client);
  session = challengeReducer(session, { type: "questions", questions });
  console.log(`\n=== COACH QUESTIONS ===`);
  for (const q of questions) console.log(`  • ${q}`);

  const evidence = argValue(args, "--evidence");
  if (!evidence) {
    console.log(`\nProvide --evidence "<your answer>" to have the coach evaluate it.`);
    return;
  }

  console.error(`\nEvaluating your evidence...`);
  session = await submitChallengeEvidence(session, evidence, resumeText, client);
  console.log(`\n=== VERDICT: ${session.status.toUpperCase()} ===`);
  console.log(session.evaluation?.reasoning ?? "");
  if (session.status === "accepted" && session.rescore) {
    const { rescore } = session;
    console.log(
      `Re-scored: ${session.originalScore} → ${rescore.match.score} (${rescore.delta >= 0 ? "+" : ""}${rescore.delta}), now ${rescore.match.tier}`,
    );
    if (session.evaluation?.suggestedResumeBullet) {
      console.log(`Suggested resume bullet: ${session.evaluation.suggestedResumeBullet}`);
    }
  } else if (session.evaluation?.missing.length) {
    console.log(`Still missing: ${session.evaluation.missing.join("; ")}`);
  }
}

await main();
