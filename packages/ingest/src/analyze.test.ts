import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { extractJobFields, ingestJobDescription } from "./analyze.js";
import type { FetchLike } from "./fetch.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");

const EXTRACTION = JSON.stringify({
  company: "Acme Corp",
  title: "Senior Backend Engineer",
  requiredSkills: ["TypeScript", "Node.js", "PostgreSQL"],
  preferredSkills: ["Kubernetes", "AWS"],
  requiredExperiences: ["5+ years software engineering", "distributed systems"],
  preferredExperiences: ["fintech/payments"],
  applicationInstructions: ["Include a cover letter", "Link to GitHub portfolio"],
});

/** Fake client that records the last prompt and returns a canned extraction. */
class RecordingClient implements ChatClient {
  lastSystem = "";
  lastUser = "";
  async chatJson(messages: ChatMessage[]): Promise<string> {
    this.lastSystem = messages.find((m) => m.role === "system")?.content ?? "";
    this.lastUser = messages.find((m) => m.role === "user")?.content ?? "";
    return EXTRACTION;
  }
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatJson(messages);
  }
}

test("extractJobFields wraps untrusted text in markers and returns validated fields", async () => {
  const client = new RecordingClient();
  const fields = await extractJobFields("We need a Go engineer.", client);
  assert.deepEqual(fields.requiredSkills, ["TypeScript", "Node.js", "PostgreSQL"]);
  // The untrusted text is delimited, and the system prompt carries the guard.
  assert.match(client.lastUser, /<<<JOB>>>[\s\S]*We need a Go engineer\.[\s\S]*<<<END JOB>>>/);
  assert.match(client.lastSystem, /UNTRUSTED DATA/);
});

test("ingestJobDescription assembles a JobDescription from text", async () => {
  const client = new RecordingClient();
  const job = await ingestJobDescription({ text: "Backend role at Acme." }, client);
  assert.equal(job.source, "text");
  assert.equal(job.company, "Acme Corp");
  assert.equal(job.rawText, "Backend role at Acme.");
  assert.equal(job.url, undefined);
});

test("ingestJobDescription extracts from a saved HTML fixture and strips scripts/injection", async () => {
  const html = await readFile(join(fixturesDir, "sample-job.html"), "utf8");
  const client = new RecordingClient();
  const job = await ingestJobDescription({ html }, client);

  assert.equal(job.source, "html");
  assert.equal(job.title, "Senior Backend Engineer");
  assert.deepEqual(job.applicationInstructions, ["Include a cover letter", "Link to GitHub portfolio"]);
  // The text handed to the model is stripped of <script>/<style> and the visible
  // requirement text survives; the injection lines are just inert data here.
  assert.match(job.rawText, /5\+ years of professional software engineering/);
  assert.doesNotMatch(job.rawText, /console\.log/);
  assert.doesNotMatch(job.rawText, /display:none/);
});

test("ingestJobDescription fetches a URL via the injected fetch", async () => {
  const fake: FetchLike = async (url) => ({
    ok: true,
    status: 200,
    text: async () => `<html><body><h1>Data Scientist</h1><p>Python required.</p></body></html>`,
  });
  const client = new RecordingClient();
  const job = await ingestJobDescription(
    { url: "https://jobs.example.com/ds" },
    client,
    { fetchImpl: fake },
  );
  assert.equal(job.source, "url");
  assert.equal(job.url, "https://jobs.example.com/ds");
  assert.match(job.rawText, /Data Scientist/);
  assert.match(job.rawText, /Python required\./);
});

test("ingestJobDescription errors when no input is provided", async () => {
  await assert.rejects(() => ingestJobDescription({}, new RecordingClient()), /provide one of/);
});
