import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import {
  JobDescription,
  LinkedInProfile,
  parseOrThrow,
  ResumeModel,
} from "@resume-prep/schema";
import { SnapshotStore } from "@resume-prep/versioning";
import { runTailoringWorkflow } from "./workflow.js";

/**
 * One fake client that answers EVERY prompt type the workflow issues, routed by
 * the system prompt. This lets a single test exercise the full cross-package
 * pipeline (review → ATS → match → cover letter → LinkedIn → generate → version)
 * with no live model.
 */
class WorkflowClient implements ChatClient {
  async chatJson(messages: ChatMessage[]): Promise<string> {
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const user = messages.find((m) => m.role === "user")?.content ?? "";

    if (system.includes("Applicant Tracking Systems")) {
      return JSON.stringify({
        atsScore: 71,
        summary: "Parseable.",
        keywords: { present: ["TypeScript"], recommended: ["Kubernetes"] },
      });
    }
    if (system.includes("tailored cover letter")) {
      return JSON.stringify({
        greeting: "Dear Globex Team,",
        paragraphs: ["I am excited to apply."],
        closing: "Sincerely, Jane",
      });
    }
    if (system.includes("evidences ONE specific job requirement")) {
      const label = user.match(/REQUIREMENT \[[^\]]+\]: (.+)/)?.[1]?.trim() ?? "";
      const score = label === "TypeScript" ? 90 : 25;
      return JSON.stringify({ score, evidence: [], rationale: `scored ${label}` });
    }
    if (system.includes("LinkedIn profile coach")) {
      return JSON.stringify({ overallScore: 68, summary: "Solid.", strengths: [], weaknesses: [], recommendations: [] });
    }
    if (system.includes("LinkedIn optimization expert")) {
      return JSON.stringify({
        summary: "Sharpen headline.",
        changes: [{ field: "headline", suggested: "Backend Engineer | TypeScript", instructions: "Edit intro" }],
      });
    }
    // resume review
    return JSON.stringify({
      overallScore: 80,
      summary: "Strong resume.",
      jobCategories: ["Backend Engineer"],
      strengths: ["Clear impact"],
      weaknesses: ["No metrics in summary"],
      recommendations: [{ title: "Add metrics", rationale: "Quantify", priority: "high" }],
    });
  }
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatJson(messages);
  }
}

const RESUME = parseOrThrow(ResumeModel, {
  contact: { name: "Jane Developer", email: "jane@example.com" },
  summary: "Backend engineer.",
  experiences: [{ title: "Senior Engineer", organization: "Acme", startDate: "2020", bullets: ["Built TS services"] }],
  skills: ["TypeScript"],
});

const JOB = parseOrThrow(JobDescription, {
  source: "text",
  rawText: "Backend Engineer at Globex needing TypeScript and Kubernetes.",
  title: "Backend Engineer",
  company: "Globex",
  requiredSkills: ["TypeScript", "Kubernetes"],
});

const PROFILE = parseOrThrow(LinkedInProfile, {
  name: "Jane Developer",
  headline: "Software Engineer",
  skills: ["TypeScript"],
});

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rp-workflow-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("runTailoringWorkflow runs the full pipeline and versions the artifacts", async () => {
  const store = new SnapshotStore({ dir });
  const result = await runTailoringWorkflow({ resume: RESUME, job: JOB }, new WorkflowClient(), store);

  // Review + ATS + fit all present and tier-classified.
  assert.equal(result.review.overallScore, 80);
  assert.equal(result.reviewTier, "reasonable");
  assert.equal(result.ats.atsScore, 71);
  assert.equal(result.fit.matches.length, 2);
  assert.deepEqual(result.coverage.covered, ["TypeScript"]);
  assert.deepEqual(result.coverage.missing, ["Kubernetes"]);

  // Cover letter + generated documents.
  assert.equal(result.coverLetter.greeting, "Dear Globex Team,");
  assert.ok(result.documents.resumeDocx.length > 0);
  assert.ok(result.documents.coverLetterDocx.length > 0);

  // No LinkedIn without a profile.
  assert.equal(result.linkedin, undefined);
  assert.equal(result.versions.linkedInChangeSet, undefined);

  // Artifacts were snapshotted.
  assert.ok(result.versions.resume.length > 0);
  const resumeHistory = await store.history("resume");
  assert.equal(resumeHistory.length, 1);
  assert.equal(resumeHistory[0]?.source, "generated");
});

test("runTailoringWorkflow falls back when the job has no title/company", async () => {
  const untitledJob = parseOrThrow(JobDescription, {
    source: "text",
    rawText: "Backend role needing TypeScript.",
    requiredSkills: ["TypeScript"],
  });
  const store = new SnapshotStore({ dir });
  const result = await runTailoringWorkflow({ resume: RESUME, job: untitledJob }, new WorkflowClient(), store);
  assert.ok(result.versions.resume.length > 0);
  // Cover letter target defaults to "job" when company is absent.
  const cover = await store.history("cover-letter:job");
  assert.equal(cover.length, 1);
});

test("runTailoringWorkflow includes a LinkedIn change set when a profile is given", async () => {
  const store = new SnapshotStore({ dir });
  const result = await runTailoringWorkflow(
    { resume: RESUME, job: JOB, linkedInProfile: PROFILE },
    new WorkflowClient(),
    store,
  );

  assert.equal(result.linkedin?.review.overallScore, 68);
  assert.equal(result.linkedin?.changeSet.changes[0]?.field, "headline");
  assert.ok(result.versions.linkedInChangeSet && result.versions.linkedInChangeSet.length > 0);
  assert.equal((await store.history("linkedin-change-set")).length, 1);
});
