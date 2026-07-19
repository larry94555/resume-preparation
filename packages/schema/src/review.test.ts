import assert from "node:assert/strict";
import { test } from "node:test";
import { AtsReview, ResumeReview } from "./review.js";
import { validate } from "./validate.js";

test("ResumeReview fills list defaults and accepts a valid review", () => {
  const result = validate(ResumeReview, {
    overallScore: 82,
    summary: "Strong backend resume.",
    strengths: ["Clear impact bullets"],
    recommendations: [
      { title: "Add metrics", rationale: "Quantify results", priority: "high" },
    ],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.jobCategories, []);
    assert.deepEqual(result.value.weaknesses, []);
    assert.equal(result.value.recommendations[0]?.priority, "high");
  }
});

test("ResumeReview rejects an out-of-range score and a bad priority", () => {
  assert.equal(validate(ResumeReview, { overallScore: 140, summary: "x" }).ok, false);
  assert.equal(
    validate(ResumeReview, {
      overallScore: 50,
      summary: "x",
      recommendations: [{ title: "t", rationale: "r", priority: "urgent" }],
    }).ok,
    false,
  );
});

test("AtsReview defaults the keywords object when omitted", () => {
  const result = validate(AtsReview, { atsScore: 70, summary: "Parseable." });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.keywords, { present: [], recommended: [] });
  }
});

test("AtsReview keeps provided keyword coverage", () => {
  const result = validate(AtsReview, {
    atsScore: 65,
    summary: "ok",
    keywords: { present: ["TypeScript"], recommended: ["Kubernetes"] },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.keywords.present, ["TypeScript"]);
    assert.deepEqual(result.value.keywords.recommended, ["Kubernetes"]);
  }
});
