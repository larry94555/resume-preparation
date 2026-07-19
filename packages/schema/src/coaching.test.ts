import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ChallengeQuestions,
  EvidenceEvaluation,
  ImprovementPlan,
} from "./coaching.js";
import { validate } from "./validate.js";

test("ChallengeQuestions defaults to an empty list", () => {
  const r = validate(ChallengeQuestions, {});
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.questions, []);
});

test("EvidenceEvaluation validates both credible and insufficient shapes", () => {
  const credible = validate(EvidenceEvaluation, {
    credible: true,
    reasoning: "Concrete metrics provided.",
    suggestedResumeBullet: "Ran a 20-node Kubernetes cluster in production.",
  });
  assert.equal(credible.ok, true);
  if (credible.ok) assert.deepEqual(credible.value.missing, []);

  const insufficient = validate(EvidenceEvaluation, {
    credible: false,
    reasoning: "Too vague.",
    missing: ["scale", "your specific role"],
  });
  assert.equal(insufficient.ok, true);

  // credible must be a boolean.
  assert.equal(validate(EvidenceEvaluation, { credible: "yes", reasoning: "x" }).ok, false);
});

test("ImprovementPlan validates actions and rejects a bad effort", () => {
  const ok = validate(ImprovementPlan, {
    summary: "Build hands-on Kubernetes experience.",
    actions: [
      { title: "Deploy a demo app", detail: "Use k3s locally.", effort: "low", timeframe: "1 weekend" },
    ],
    resources: ["CKA course"],
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.actions[0]?.effort, "low");

  assert.equal(
    validate(ImprovementPlan, {
      summary: "x",
      actions: [{ title: "t", detail: "d", effort: "extreme" }],
    }).ok,
    false,
  );
});
