import assert from "node:assert/strict";
import { test } from "node:test";
import { LlamaClient } from "@resume-prep/llm";
import { parseOrThrow, LinkedInProfile } from "@resume-prep/schema";
import { buildLinkedInChangeSet } from "./changeset.js";
import { reviewLinkedIn } from "./profile.js";

const PROFILE = parseOrThrow(LinkedInProfile, {
  name: "Jane Developer",
  headline: "Software Engineer",
  about: "Backend engineer with 6 years building distributed systems.",
  experiences: [{ title: "Senior Engineer", organization: "Acme", startDate: "2020", bullets: ["Cut latency 40%"] }],
  skills: ["TypeScript", "Node.js"],
});

/** Live eval; self-skips without a reachable endpoint. */
test("live model reviews a profile and builds a change set (skips if no endpoint)", async (t) => {
  const client = new LlamaClient();
  if (!(await client.health())) {
    t.skip("no LLM endpoint reachable (set LLM_BASE_URL to run this)");
    return;
  }
  const review = await reviewLinkedIn(PROFILE, client);
  assert.ok(review.overallScore >= 0 && review.overallScore <= 100);
  const changeSet = await buildLinkedInChangeSet(PROFILE, client);
  assert.ok(Array.isArray(changeSet.changes));
});
