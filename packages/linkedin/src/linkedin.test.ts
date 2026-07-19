import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { buildLinkedInChangeSet } from "./changeset.js";
import { importLinkedInProfile, reviewLinkedIn, structureLinkedInProfile } from "./profile.js";

const PROFILE_JSON = JSON.stringify({
  name: "Jane Developer",
  headline: "Backend Engineer",
  about: "I build distributed systems.",
  experiences: [{ title: "Senior Engineer", organization: "Acme", startDate: "2020", bullets: ["Cut latency 40%"] }],
  skills: ["TypeScript"],
});

const REVIEW_JSON = JSON.stringify({
  overallScore: 74,
  summary: "Solid profile, headline could be sharper.",
  strengths: ["Clear experience"],
  weaknesses: ["Generic headline"],
  recommendations: [{ title: "Sharpen headline", rationale: "Add specialization + keywords", priority: "high" }],
});

const CHANGESET_JSON = JSON.stringify({
  summary: "Sharpen the headline and About.",
  changes: [
    { field: "headline", current: "Backend Engineer", suggested: "Backend Engineer | Distributed Systems | TypeScript", instructions: "Edit intro > Headline" },
  ],
});

/** Routes by prompt: structure vs. review vs. changeset. */
class RoutingClient implements ChatClient {
  lastUser = "";
  async chatJson(messages: ChatMessage[]): Promise<string> {
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    this.lastUser = messages.find((m) => m.role === "user")?.content ?? "";
    if (system.includes("convert the plain text")) return PROFILE_JSON;
    if (system.includes("LinkedIn profile coach")) return REVIEW_JSON;
    return CHANGESET_JSON;
  }
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatJson(messages);
  }
}

test("structureLinkedInProfile returns a validated profile", async () => {
  const profile = await structureLinkedInProfile("Jane Developer\nBackend Engineer", new RoutingClient());
  assert.equal(profile.name, "Jane Developer");
  assert.equal(profile.experiences[0]?.organization, "Acme");
});

test("importLinkedInProfile ingests pasted text", async () => {
  const profile = await importLinkedInProfile({ format: "text", text: "Jane Developer profile ..." }, new RoutingClient());
  assert.equal(profile.name, "Jane Developer");
});

test("reviewLinkedIn returns a validated review", async () => {
  const profile = await structureLinkedInProfile("x", new RoutingClient());
  const review = await reviewLinkedIn(profile, new RoutingClient());
  assert.equal(review.overallScore, 74);
  assert.equal(review.recommendations[0]?.priority, "high");
});

test("buildLinkedInChangeSet returns copy-paste changes and can tailor to a job", async () => {
  const profile = await structureLinkedInProfile("x", new RoutingClient());
  const client = new RoutingClient();
  const changeSet = await buildLinkedInChangeSet(profile, client, { targetJobText: "Kubernetes platform role." });
  assert.equal(changeSet.changes[0]?.field, "headline");
  assert.match(changeSet.changes[0]?.suggested ?? "", /Distributed Systems/);
  assert.match(client.lastUser, /TARGET JOB START/);
  assert.match(client.lastUser, /Kubernetes platform role/);
});
