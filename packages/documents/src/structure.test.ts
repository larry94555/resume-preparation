import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { ingestResume } from "./ingest.js";
import { structureResume } from "./structure.js";

/** A ChatClient that returns a fixed completion and records the last user prompt. */
class FakeClient implements ChatClient {
  lastUser = "";
  constructor(private readonly reply: string) {}
  async chatJson(messages: ChatMessage[]): Promise<string> {
    this.lastUser = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    return this.reply;
  }
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatJson(messages);
  }
}

const CANNED = JSON.stringify({
  contact: { name: "Jane Developer", email: "jane@example.com" },
  summary: "Backend engineer.",
  experiences: [
    {
      title: "Senior Engineer",
      organization: "Acme Corp",
      startDate: "2020",
      endDate: "Present",
      bullets: ["Built a distributed job scheduler."],
    },
  ],
  skills: ["TypeScript", "Node.js"],
});

test("structureResume returns a validated ResumeModel with defaults filled", async () => {
  const client = new FakeClient(CANNED);
  const resume = await structureResume("Jane Developer\nSenior Engineer at Acme", client);

  assert.equal(resume.contact.name, "Jane Developer");
  assert.equal(resume.experiences[0]?.organization, "Acme Corp");
  assert.deepEqual(resume.skills, ["TypeScript", "Node.js"]);
  // Omitted collections are defaulted, not undefined.
  assert.deepEqual(resume.education, []);
  assert.deepEqual(resume.certifications, []);
  assert.deepEqual(resume.projects, []);
  assert.deepEqual(resume.contact.links, []);
  // The resume text was actually placed in the prompt.
  assert.match(client.lastUser, /Senior Engineer at Acme/);
});

test("structureResume repairs a model that first omits a required field", async () => {
  // First reply is missing contact.name; runStructured should re-prompt and the
  // fake returns the same thing — so it must eventually throw, proving repair ran.
  const bad = JSON.stringify({ contact: { email: "x@y.z" } });
  const client = new FakeClient(bad);
  await assert.rejects(
    () => structureResume("text", client),
    /schema-valid JSON/,
  );
});

test("ingestResume composes text extraction and structuring", async () => {
  const client = new FakeClient(CANNED);
  const resume = await ingestResume(
    { format: "text", text: "Jane Developer resume ..." },
    client,
  );
  assert.equal(resume.contact.name, "Jane Developer");
});
