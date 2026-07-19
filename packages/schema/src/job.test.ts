import assert from "node:assert/strict";
import { test } from "node:test";
import { JobDescription, JobExtraction } from "./job.js";
import { MatchAssessment } from "./match.js";
import { validate } from "./validate.js";

test("JobExtraction fills all requirement arrays by default", () => {
  const result = validate(JobExtraction, { title: "Backend Engineer" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.requiredSkills, []);
    assert.deepEqual(result.value.preferredSkills, []);
    assert.deepEqual(result.value.requiredExperiences, []);
    assert.deepEqual(result.value.preferredExperiences, []);
    assert.deepEqual(result.value.applicationInstructions, []);
  }
});

test("JobDescription requires source and rawText provenance", () => {
  assert.equal(
    validate(JobDescription, { title: "X", requiredSkills: ["Go"] }).ok,
    false, // missing source + rawText
  );
  const ok = validate(JobDescription, {
    source: "url",
    url: "https://jobs.example.com/123",
    rawText: "We are hiring a Go engineer.",
    requiredSkills: ["Go"],
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.source, "url");
});

test("MatchAssessment validates score range and defaults evidence", () => {
  const ok = validate(MatchAssessment, { score: 72, rationale: "Direct match." });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.value.evidence, []);
  assert.equal(validate(MatchAssessment, { score: 120, rationale: "x" }).ok, false);
});
