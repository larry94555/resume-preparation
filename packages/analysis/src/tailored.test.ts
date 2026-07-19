import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { JobDescription, parseOrThrow, ResumeModel } from "@resume-prep/schema";
import { scoreTailoredResume, summarizeCoverage } from "./tailored.js";
import type { RequirementMatch } from "./matching.js";

test("summarizeCoverage splits strong/reasonable from the rest", () => {
  const mk = (label: string, tier: RequirementMatch["tier"]): RequirementMatch => ({
    label,
    kind: "skill",
    importance: "required",
    score: 0,
    evidence: [],
    rationale: "",
    tier,
  });
  const { covered, missing } = summarizeCoverage([
    mk("TypeScript", "strong"),
    mk("Node.js", "reasonable"),
    mk("Kubernetes", "weak"),
    mk("Rust", "stretch"),
  ]);
  assert.deepEqual(covered, ["TypeScript", "Node.js"]);
  assert.deepEqual(missing, ["Kubernetes", "Rust"]);
});

const RESUME = parseOrThrow(ResumeModel, {
  contact: { name: "Jane Developer", email: "jane@example.com" },
  summary: "Backend engineer targeting platform roles.",
  experiences: [{ title: "Senior Engineer", organization: "Acme", startDate: "2020", bullets: ["Built TS services"] }],
  skills: ["TypeScript"],
});

const JOB = parseOrThrow(JobDescription, {
  source: "text",
  rawText: "Backend Engineer needing TypeScript and Kubernetes.",
  title: "Backend Engineer",
  requiredSkills: ["TypeScript", "Kubernetes"],
});

/** Routing fake: ATS review vs. per-requirement scoring. */
class TailoredClient implements ChatClient {
  async chatJson(messages: ChatMessage[]): Promise<string> {
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    if (system.includes("Applicant Tracking Systems")) {
      return JSON.stringify({
        atsScore: 72,
        summary: "Parseable.",
        keywords: { present: ["TypeScript"], recommended: ["Kubernetes"] },
      });
    }
    const label = user.match(/REQUIREMENT \[[^\]]+\]: (.+)/)?.[1]?.trim() ?? "";
    const score = label === "TypeScript" ? 90 : 20;
    return JSON.stringify({ score, evidence: [], rationale: `scored ${label}` });
  }
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatJson(messages);
  }
}

test("scoreTailoredResume combines fit, ATS, coverage, keywords, and objective", async () => {
  const score = await scoreTailoredResume(RESUME, JOB, new TailoredClient());
  assert.deepEqual(score.coveredRequirements, ["TypeScript"]);
  assert.deepEqual(score.missingRequirements, ["Kubernetes"]);
  assert.deepEqual(score.keywordMatches, ["TypeScript"]);
  assert.deepEqual(score.keywordGaps, ["Kubernetes"]);
  assert.equal(score.hasClearObjective, true);
  assert.equal(score.ats.atsScore, 72);
  assert.ok(score.fit.overallScore > 0);
});

test("hasClearObjective is false when the resume lacks a summary", async () => {
  const noSummary = parseOrThrow(ResumeModel, {
    contact: { name: "Min Imal" },
    skills: ["TypeScript"],
  });
  const score = await scoreTailoredResume(noSummary, JOB, new TailoredClient());
  assert.equal(score.hasClearObjective, false);
});
