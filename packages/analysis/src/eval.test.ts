import assert from "node:assert/strict";
import { test } from "node:test";
import { LlamaClient } from "@resume-prep/llm";
import { parseOrThrow, ResumeModel } from "@resume-prep/schema";
import { reviewAll } from "./review-all.js";

const SAMPLE = parseOrThrow(ResumeModel, {
  contact: { name: "Jane Developer", email: "jane@example.com", location: "Seattle, WA" },
  summary: "Backend engineer with 6 years building distributed systems.",
  experiences: [
    {
      title: "Senior Software Engineer",
      organization: "Acme Corp",
      startDate: "2020",
      endDate: "Present",
      bullets: [
        "Cut p99 API latency by 40% by redesigning the caching layer.",
        "Led a team of 4 engineers delivering a new billing platform.",
      ],
    },
  ],
  education: [{ degree: "BS", field: "Computer Science", institution: "State University", endDate: "2016" }],
  skills: ["TypeScript", "Node.js", "PostgreSQL", "AWS"],
});

/**
 * Live evaluation of the review pipeline. SELF-SKIPS when no model endpoint is
 * reachable (so CI stays green); run locally against your llama-server / Ollama
 * to sanity-check that both reviews return schema-valid, in-range results.
 */
test("live model produces valid resume + ATS reviews (skips if no endpoint)", async (t) => {
  const client = new LlamaClient();
  if (!(await client.health())) {
    t.skip("no LLM endpoint reachable (set LLM_BASE_URL to run this)");
    return;
  }

  const full = await reviewAll(SAMPLE, client);
  assert.ok(full.review.overallScore >= 0 && full.review.overallScore <= 100);
  assert.ok(full.ats.atsScore >= 0 && full.ats.atsScore <= 100);
  assert.ok(full.review.summary.length > 0);
  assert.ok(Array.isArray(full.ats.keywords.present));
});
