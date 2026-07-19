import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { JobDescription, parseOrThrow, ResumeModel } from "@resume-prep/schema";
import { composeCoverLetter } from "./cover-letter.js";

const RESUME = parseOrThrow(ResumeModel, {
  contact: { name: "Jane Developer", email: "jane@example.com" },
  experiences: [{ title: "Senior Engineer", organization: "Acme", bullets: ["Built TypeScript services"] }],
  skills: ["TypeScript"],
});

const JOB = parseOrThrow(JobDescription, {
  source: "text",
  rawText: "Backend Engineer at Globex.",
  title: "Backend Engineer",
  company: "Globex",
  requiredSkills: ["TypeScript", "Node.js"],
});

test("composeCoverLetter returns a validated letter and includes job + resume context", async () => {
  let seenUser = "";
  const client: ChatClient = {
    async chatJson(messages: ChatMessage[]) {
      seenUser = messages.find((m) => m.role === "user")?.content ?? "";
      return JSON.stringify({
        greeting: "Dear Globex Team,",
        paragraphs: ["I am excited to apply for the Backend Engineer role.", "My TypeScript experience fits your needs."],
        closing: "Sincerely, Jane Developer",
      });
    },
    chatText(messages: ChatMessage[]) {
      return this.chatJson(messages);
    },
  };

  const letter = await composeCoverLetter(RESUME, JOB, client);
  assert.equal(letter.paragraphs.length, 2);
  assert.equal(letter.greeting, "Dear Globex Team,");
  // Both the job and the resume reached the prompt.
  assert.match(seenUser, /Backend Engineer/);
  assert.match(seenUser, /Globex/);
  assert.match(seenUser, /Jane Developer/);
});
