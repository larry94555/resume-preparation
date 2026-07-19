import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { parseOrThrow, ResumeModel } from "@resume-prep/schema";
import { reviewAll } from "./review-all.js";
import { reviewAts } from "./ats.js";
import { reviewResume } from "./review-resume.js";

const REVIEW_JSON = JSON.stringify({
  overallScore: 82,
  summary: "Strong backend resume with quantified impact.",
  jobCategories: ["Backend Engineer"],
  strengths: ["Quantified achievements"],
  weaknesses: ["No summary tailoring"],
  recommendations: [{ title: "Tailor summary", rationale: "Match target roles", priority: "medium" }],
});

const ATS_JSON = JSON.stringify({
  atsScore: 68,
  summary: "Parseable but missing keywords.",
  strengths: ["Standard headings"],
  weaknesses: ["Sparse keywords"],
  recommendations: [{ title: "Add skills section keywords", rationale: "Improve match", priority: "high" }],
  keywords: { present: ["TypeScript"], recommended: ["Kubernetes", "CI/CD"] },
});

/**
 * A ChatClient that returns the right canned review based on which prompt it
 * sees. Routing by content (not call order) keeps it correct even though
 * reviewAll fires both reviews concurrently.
 */
class RoutingClient implements ChatClient {
  async chatJson(messages: ChatMessage[]): Promise<string> {
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    return system.includes("Applicant Tracking Systems") ? ATS_JSON : REVIEW_JSON;
  }
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatJson(messages);
  }
}

const RESUME = parseOrThrow(ResumeModel, {
  contact: { name: "Jane Developer", email: "jane@example.com" },
  experiences: [{ title: "Senior Engineer", organization: "Acme", startDate: "2020", bullets: ["Cut latency 40%"] }],
  skills: ["TypeScript"],
});

test("reviewResume returns a validated ResumeReview", async () => {
  const review = await reviewResume(RESUME, new RoutingClient());
  assert.equal(review.overallScore, 82);
  assert.deepEqual(review.jobCategories, ["Backend Engineer"]);
  assert.equal(review.recommendations[0]?.priority, "medium");
});

test("reviewAts returns a validated AtsReview with keyword coverage", async () => {
  const ats = await reviewAts(RESUME, new RoutingClient());
  assert.equal(ats.atsScore, 68);
  assert.deepEqual(ats.keywords.recommended, ["Kubernetes", "CI/CD"]);
});

test("reviewAts embeds a target job description when provided", async () => {
  // Capture the ATS prompt to confirm the target text is included.
  let atsUser = "";
  const client: ChatClient = {
    async chatJson(messages: ChatMessage[]) {
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      if (system.includes("Applicant Tracking Systems")) {
        atsUser = messages.find((m) => m.role === "user")?.content ?? "";
      }
      return ATS_JSON;
    },
    chatText(messages: ChatMessage[]) {
      return this.chatJson(messages);
    },
  };
  await reviewAts(RESUME, client, { targetJobText: "We need a Kubernetes and CI/CD expert." });
  assert.match(atsUser, /TARGET JOB START/);
  assert.match(atsUser, /Kubernetes and CI\/CD expert/);
});

test("reviewAll runs both reviews and classifies each score into a tier", async () => {
  const full = await reviewAll(RESUME, new RoutingClient());
  assert.equal(full.review.overallScore, 82);
  assert.equal(full.reviewTier, "reasonable"); // 82 → reasonable (70-84)
  assert.equal(full.ats.atsScore, 68);
  assert.equal(full.atsTier, "weak"); // 68 → weak (50-69)
  assert.equal(full.signals.hasEmail, true);
  assert.equal(full.signals.quantifiedBulletCount, 1);
});
