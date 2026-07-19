import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import type { RequirementMatch } from "./matching.js";
import { planImprovement } from "./improve.js";

const MATCH: RequirementMatch = {
  label: "Kubernetes",
  kind: "skill",
  importance: "required",
  score: 20,
  evidence: [],
  rationale: "No Kubernetes evidence in the resume.",
  tier: "stretch",
};

const PLAN = JSON.stringify({
  summary: "Build hands-on Kubernetes experience through a real project.",
  actions: [
    { title: "Deploy a demo app on k3s", detail: "Stand up a local cluster and deploy a service.", effort: "low", timeframe: "1 weekend" },
    { title: "Earn the CKA certification", detail: "Study and pass the Certified Kubernetes Administrator exam.", effort: "high", timeframe: "3 months" },
  ],
  resources: ["Kubernetes docs", "CKA course"],
});

test("planImprovement returns a validated plan and includes the requirement in the prompt", async () => {
  let seenUser = "";
  const client: ChatClient = {
    async chatJson(messages: ChatMessage[]) {
      seenUser = messages.find((m) => m.role === "user")?.content ?? "";
      return PLAN;
    },
    chatText(messages: ChatMessage[]) {
      return this.chatJson(messages);
    },
  };

  const plan = await planImprovement(MATCH, client);
  assert.equal(plan.actions.length, 2);
  assert.equal(plan.actions[0]?.effort, "low");
  assert.deepEqual(plan.resources, ["Kubernetes docs", "CKA course"]);
  // The current score and requirement label reached the model.
  assert.match(seenUser, /Kubernetes/);
  assert.match(seenUser, /20\/100/);
  assert.match(seenUser, /none found in the resume/);
});

test("planImprovement renders existing evidence and omits an empty rationale", async () => {
  let seenUser = "";
  const client: ChatClient = {
    async chatJson(messages: ChatMessage[]) {
      seenUser = messages.find((m) => m.role === "user")?.content ?? "";
      return PLAN;
    },
    chatText(messages: ChatMessage[]) {
      return this.chatJson(messages);
    },
  };
  const withEvidence: RequirementMatch = {
    ...MATCH,
    score: 55,
    evidence: ["Deployed services on EKS"],
    rationale: "", // empty rationale line should be dropped from the prompt
    tier: "weak",
  };
  await planImprovement(withEvidence, client);
  assert.match(seenUser, /Current supporting evidence: Deployed services on EKS/);
  assert.doesNotMatch(seenUser, /Assessment:/);
});
