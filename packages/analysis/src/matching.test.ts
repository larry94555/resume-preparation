import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { JobDescription, parseOrThrow, ResumeModel } from "@resume-prep/schema";
import {
  buildFitReport,
  flattenRequirements,
  matchResumeToJob,
  type RequirementMatch,
} from "./matching.js";

const JOB = parseOrThrow(JobDescription, {
  source: "text",
  rawText: "…",
  title: "Backend Engineer",
  requiredSkills: ["TypeScript", "Kubernetes"],
  preferredSkills: ["AWS"],
  requiredExperiences: ["distributed systems"],
  preferredExperiences: ["fintech"],
});

test("flattenRequirements orders required-first with correct kind/importance", () => {
  const reqs = flattenRequirements(JOB);
  assert.deepEqual(reqs, [
    { label: "TypeScript", kind: "skill", importance: "required" },
    { label: "Kubernetes", kind: "skill", importance: "required" },
    { label: "distributed systems", kind: "experience", importance: "required" },
    { label: "AWS", kind: "skill", importance: "preferred" },
    { label: "fintech", kind: "experience", importance: "preferred" },
  ]);
});

test("buildFitReport aggregates deterministically and flags required stretch gaps", () => {
  const mk = (
    label: string,
    score: number,
    importance: "required" | "preferred",
  ): RequirementMatch => ({
    label,
    kind: "skill",
    importance,
    score,
    evidence: [],
    rationale: "",
    tier: score >= 85 ? "strong" : score >= 70 ? "reasonable" : score >= 50 ? "weak" : score >= 30 ? "very_weak" : "stretch",
  });
  const report = buildFitReport([
    mk("TypeScript", 90, "required"),
    mk("Kubernetes", 10, "required"), // required + stretch → critical gap
    mk("AWS", 20, "preferred"), // preferred stretch → NOT a critical gap
  ]);
  assert.equal(report.tierCounts.strong, 1);
  assert.equal(report.tierCounts.stretch, 2);
  assert.deepEqual(
    report.criticalGaps.map((g) => g.label),
    ["Kubernetes"],
  );
  // weighted = (90*2 + 10*2 + 20*1) / 5 = 220/5 = 44 → very_weak → "a stretch"
  assert.equal(report.overallScore, 44);
  assert.equal(report.overallTier, "very_weak");
  assert.equal(report.verdict, "a stretch");
});

/**
 * Fake client that scores each requirement by looking up its label (parsed from
 * the prompt) in a map. Correct regardless of call order.
 */
class MapClient implements ChatClient {
  constructor(private readonly scores: Record<string, number>) {}
  async chatJson(messages: ChatMessage[]): Promise<string> {
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    const label = user.match(/REQUIREMENT \[[^\]]+\]: (.+)/)?.[1]?.trim() ?? "";
    const score = this.scores[label] ?? 0;
    return JSON.stringify({
      score,
      evidence: score > 0 ? [`resume mentions ${label}`] : [],
      rationale: `scored ${label} at ${score}`,
    });
  }
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatJson(messages);
  }
}

const RESUME = parseOrThrow(ResumeModel, {
  contact: { name: "Jane Developer", email: "jane@example.com" },
  experiences: [{ title: "Senior Engineer", organization: "Acme", startDate: "2020", bullets: ["Built TS services"] }],
  skills: ["TypeScript"],
});

test("matchResumeToJob scores every requirement and builds a fit report", async () => {
  const client = new MapClient({
    TypeScript: 92, // strong
    Kubernetes: 15, // required, stretch → critical gap
    "distributed systems": 60, // required, weak → also a stretch → critical gap
    AWS: 40, // preferred, very weak → NOT a critical gap (not required)
    fintech: 5, // preferred, stretch → NOT a critical gap (not required)
  });
  const progress: Array<{ done: number; total: number; label: string; score: number }> = [];
  const report = await matchResumeToJob(RESUME, JOB, client, (done, total, match) =>
    progress.push({ done, total, label: match.label, score: match.score }),
  );

  // onProgress fires once per requirement (with the scored match), counting up.
  assert.equal(progress.length, 5);
  assert.deepEqual(progress[0], { done: 1, total: 5, label: "TypeScript", score: 92 });
  assert.equal(progress[4]?.label, "fintech");
  assert.equal(progress[4]?.done, 5);

  assert.equal(report.matches.length, 5);
  const ts = report.matches.find((m) => m.label === "TypeScript");
  assert.equal(ts?.score, 92);
  assert.equal(ts?.tier, "strong");
  assert.deepEqual(ts?.evidence, ["resume mentions TypeScript"]);
  // Only REQUIRED requirements in a stretch tier (weak/very_weak/stretch) are
  // critical gaps — the two required ones that scored low, not the preferred ones.
  assert.deepEqual(
    report.criticalGaps.map((g) => g.label),
    ["Kubernetes", "distributed systems"],
  );
  assert.ok(report.overallScore > 0 && report.overallScore <= 100);
});
