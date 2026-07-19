import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import type { RequirementMatch } from "./matching.js";
import {
  askChallengeQuestions,
  augmentResumeWithEvidence,
  challengeReducer,
  startChallengeSession,
  submitChallengeEvidence,
} from "./challenge.js";

const MATCH: RequirementMatch = {
  label: "Kubernetes",
  kind: "skill",
  importance: "required",
  score: 20,
  evidence: [],
  rationale: "No Kubernetes evidence in the resume.",
  tier: "stretch",
};

const RESUME_TEXT = "Jane Developer\nEXPERIENCE\nSenior Engineer — Acme (2020 – Present)\n- Built TS services";

test("startChallengeSession seeds from the disputed match", () => {
  const s = startChallengeSession(MATCH);
  assert.deepEqual(s.requirement, { label: "Kubernetes", kind: "skill", importance: "required" });
  assert.equal(s.originalScore, 20);
  assert.equal(s.originalTier, "stretch");
  assert.equal(s.status, "awaiting_evidence");
  assert.deepEqual(s.questions, []);
});

test("challengeReducer advances through questions, evidence, and evaluation", () => {
  let s = startChallengeSession(MATCH);
  s = challengeReducer(s, { type: "questions", questions: ["What scale?", "Your role?"] });
  assert.deepEqual(s.questions, ["What scale?", "Your role?"]);

  s = challengeReducer(s, { type: "evidence", text: "Ran a 20-node cluster." });
  assert.equal(s.evidence, "Ran a 20-node cluster.");
  assert.equal(s.status, "awaiting_evidence"); // evidence alone doesn't resolve

  s = challengeReducer(s, {
    type: "evaluation",
    evaluation: { credible: false, reasoning: "Vague.", missing: ["metrics"] },
  });
  assert.equal(s.status, "insufficient");
  assert.equal(s.rescore, undefined);
});

test("askChallengeQuestions returns the coach's questions and sees the requirement", async () => {
  let seenUser = "";
  const client: ChatClient = {
    async chatJson(messages: ChatMessage[]) {
      seenUser = messages.find((m) => m.role === "user")?.content ?? "";
      return JSON.stringify({ questions: ["What scale did you operate at?", "What was your exact role?"] });
    },
    chatText(messages: ChatMessage[]) {
      return this.chatJson(messages);
    },
  };
  const questions = await askChallengeQuestions(
    { label: "Kubernetes", kind: "skill", importance: "required" },
    20,
    RESUME_TEXT,
    client,
  );
  assert.equal(questions.length, 2);
  assert.match(seenUser, /Kubernetes/);
  assert.match(seenUser, /20\/100/);
});

test("augmentResumeWithEvidence appends a labeled pending section", () => {
  const out = augmentResumeWithEvidence(RESUME_TEXT, "Ran a 20-node k8s cluster.", "Operated a 20-node Kubernetes cluster.");
  assert.match(out, /pending resume update/);
  assert.match(out, /Ran a 20-node k8s cluster\./);
  assert.match(out, /Suggested bullet: Operated a 20-node Kubernetes cluster\./);
});

/** Fake client routing by prompt: evidence evaluation vs. re-score. */
function makeClient(opts: { credible: boolean; newScore: number }): ChatClient {
  return {
    async chatJson(messages: ChatMessage[]) {
      const system = messages.find((m) => m.role === "system")?.content ?? "";
      if (system.includes("evaluating whether newly provided evidence")) {
        return JSON.stringify({
          credible: opts.credible,
          reasoning: opts.credible ? "Concrete and quantified." : "Too vague to verify.",
          missing: opts.credible ? [] : ["specific metrics", "your role"],
          ...(opts.credible ? { suggestedResumeBullet: "Operated a 20-node Kubernetes cluster in production." } : {}),
        });
      }
      // score-requirement re-score
      return JSON.stringify({
        score: opts.newScore,
        evidence: ["Operated a 20-node Kubernetes cluster"],
        rationale: `Re-scored to ${opts.newScore}.`,
      });
    },
    chatText(messages: ChatMessage[]) {
      return this.chatJson(messages);
    },
  };
}

test("submitChallengeEvidence accepts credible evidence and re-scores with a positive delta", async () => {
  const session = startChallengeSession(MATCH);
  const resolved = await submitChallengeEvidence(
    session,
    "I operated a 20-node production Kubernetes cluster for 2 years, cutting deploy time 60%.",
    RESUME_TEXT,
    makeClient({ credible: true, newScore: 80 }),
  );
  assert.equal(resolved.status, "accepted");
  assert.equal(resolved.evidence?.startsWith("I operated"), true);
  assert.equal(resolved.evaluation?.credible, true);
  assert.equal(resolved.rescore?.match.score, 80);
  assert.equal(resolved.rescore?.match.tier, "reasonable");
  assert.equal(resolved.rescore?.delta, 60); // 80 − 20
  assert.equal(resolved.rescore?.improved, true);
});

test("submitChallengeEvidence rejects insufficient evidence and explains what's missing", async () => {
  const session = startChallengeSession(MATCH);
  const resolved = await submitChallengeEvidence(
    session,
    "I know Kubernetes.",
    RESUME_TEXT,
    makeClient({ credible: false, newScore: 0 }),
  );
  assert.equal(resolved.status, "insufficient");
  assert.equal(resolved.rescore, undefined);
  assert.deepEqual(resolved.evaluation?.missing, ["specific metrics", "your role"]);
});
