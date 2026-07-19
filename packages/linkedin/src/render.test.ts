import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOrThrow, LinkedInProfile } from "@resume-prep/schema";
import { renderLinkedInText } from "./render.js";

test("renderLinkedInText emits labeled sections", () => {
  const profile = parseOrThrow(LinkedInProfile, {
    name: "Jane Developer",
    headline: "Backend Engineer",
    location: "Seattle, WA",
    about: "I build reliable distributed systems.",
    experiences: [{ title: "Senior Engineer", organization: "Acme", startDate: "2020", bullets: ["Cut latency 40%"] }],
    education: [{ degree: "BS", field: "CS", institution: "State U" }],
    skills: ["TypeScript", "Kubernetes"],
  });
  const text = renderLinkedInText(profile);
  assert.match(text, /Jane Developer\nBackend Engineer\nSeattle, WA/);
  assert.match(text, /ABOUT\nI build reliable/);
  assert.match(text, /Senior Engineer — Acme \(2020 – Present\)/);
  assert.match(text, /- Cut latency 40%/);
  assert.match(text, /EDUCATION\nBS — CS — State U/);
  assert.match(text, /SKILLS\nTypeScript, Kubernetes/);
});

test("renderLinkedInText omits empty sections", () => {
  const minimal = parseOrThrow(LinkedInProfile, { name: "Min Imal" });
  const text = renderLinkedInText(minimal);
  assert.equal(text, "Min Imal");
});
