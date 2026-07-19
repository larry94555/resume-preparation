import assert from "node:assert/strict";
import { test } from "node:test";
import { LinkedInChangeSet, LinkedInProfile, LinkedInReview } from "./linkedin.js";
import { validate } from "./validate.js";

test("LinkedInProfile requires a name and defaults its collections", () => {
  const r = validate(LinkedInProfile, { name: "Jane Developer", headline: "Backend Engineer" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.experiences, []);
    assert.deepEqual(r.value.skills, []);
  }
  assert.equal(validate(LinkedInProfile, { headline: "x" }).ok, false);
});

test("LinkedInReview validates score range", () => {
  assert.equal(validate(LinkedInReview, { overallScore: 77, summary: "Solid." }).ok, true);
  assert.equal(validate(LinkedInReview, { overallScore: -1, summary: "x" }).ok, false);
});

test("LinkedInChangeSet validates changes with required suggested + instructions", () => {
  const ok = validate(LinkedInChangeSet, {
    summary: "Sharpen the headline and About.",
    changes: [
      { field: "headline", current: "Engineer", suggested: "Backend Engineer | Distributed Systems", instructions: "Edit the intro card." },
    ],
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.changes[0]?.field, "headline");

  assert.equal(
    validate(LinkedInChangeSet, { summary: "x", changes: [{ field: "headline" }] }).ok,
    false, // missing suggested + instructions
  );
});
