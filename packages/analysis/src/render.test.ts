import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOrThrow, ResumeModel } from "@resume-prep/schema";
import { renderResumeText } from "./render.js";

const FULL = parseOrThrow(ResumeModel, {
  contact: {
    name: "Jane Developer",
    email: "jane@example.com",
    location: "Seattle, WA",
    links: ["linkedin.com/in/jane"],
  },
  summary: "Backend engineer with 6 years of experience.",
  experiences: [
    {
      title: "Senior Engineer",
      organization: "Acme Corp",
      startDate: "2020",
      endDate: "Present",
      bullets: ["Cut latency by 40%.", "Led a team of 4."],
    },
  ],
  education: [{ degree: "BS", field: "CS", institution: "State University", endDate: "2016" }],
  skills: ["TypeScript", "Node.js"],
  certifications: [{ name: "AWS SA", issuer: "Amazon", date: "2022" }],
  projects: [{ name: "Scheduler", description: "OSS job runner", link: "github.com/jane/sched" }],
});

test("renderResumeText emits labeled sections with content", () => {
  const text = renderResumeText(FULL);
  assert.match(text, /Jane Developer/);
  assert.match(text, /jane@example\.com \| Seattle, WA/);
  assert.match(text, /Links: linkedin\.com\/in\/jane/);
  assert.match(text, /SUMMARY/);
  assert.match(text, /EXPERIENCE/);
  assert.match(text, /Senior Engineer — Acme Corp \(2020 – Present\)/);
  assert.match(text, /- Cut latency by 40%\./);
  assert.match(text, /EDUCATION/);
  assert.match(text, /SKILLS\nTypeScript, Node\.js/);
  assert.match(text, /CERTIFICATIONS/);
  assert.match(text, /PROJECTS/);
});

test("renderResumeText omits empty sections and open-ended date ranges", () => {
  const minimal = parseOrThrow(ResumeModel, {
    contact: { name: "Min Imal" },
    experiences: [{ title: "Dev", organization: "Startup", startDate: "2021" }],
  });
  const text = renderResumeText(minimal);
  assert.match(text, /Dev — Startup \(2021 – Present\)/);
  assert.doesNotMatch(text, /SUMMARY/);
  assert.doesNotMatch(text, /EDUCATION/);
  assert.doesNotMatch(text, /SKILLS/);
  assert.doesNotMatch(text, /CERTIFICATIONS/);
  assert.doesNotMatch(text, /PROJECTS/);
});
