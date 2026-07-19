import assert from "node:assert/strict";
import { test } from "node:test";
import { LlamaClient } from "@resume-prep/llm";
import { renderResumeText } from "./render.js";
import { scoreRequirement } from "./matching.js";
import { planImprovement } from "./improve.js";
import { startChallengeSession, submitChallengeEvidence } from "./challenge.js";
import { parseOrThrow, ResumeModel } from "@resume-prep/schema";

const RESUME = parseOrThrow(ResumeModel, {
  contact: { name: "Jane Developer", email: "jane@example.com" },
  experiences: [
    { title: "Senior Engineer", organization: "Acme", startDate: "2020", bullets: ["Built TypeScript services"] },
  ],
  skills: ["TypeScript", "Node.js"],
});

/**
 * Live evaluation of the coaching flows. SELF-SKIPS when no model endpoint is
 * reachable (keeps CI green); run locally to sanity-check challenge + improve.
 */
test("live model runs challenge + improve for a requirement (skips if no endpoint)", async (t) => {
  const client = new LlamaClient();
  if (!(await client.health())) {
    t.skip("no LLM endpoint reachable (set LLM_BASE_URL to run this)");
    return;
  }

  const resumeText = renderResumeText(RESUME);
  const req = { label: "Kubernetes", kind: "skill", importance: "required" } as const;
  const match = await scoreRequirement(req, resumeText, client);

  const session = startChallengeSession(match);
  const resolved = await submitChallengeEvidence(
    session,
    "I ran a 15-node production Kubernetes cluster for two years and cut deploy time by half.",
    resumeText,
    client,
  );
  assert.ok(resolved.status === "accepted" || resolved.status === "insufficient");

  const plan = await planImprovement(match, client);
  assert.ok(plan.summary.length > 0);
  assert.ok(Array.isArray(plan.actions));
});
