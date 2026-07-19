import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOrThrow, ResumeModel } from "@resume-prep/schema";
import { computeAtsSignals, renderAtsSignals } from "./ats-signals.js";

test("computeAtsSignals reports objective facts about a rich resume", () => {
  const resume = parseOrThrow(ResumeModel, {
    contact: { name: "Jane", email: "j@x.com", phone: "555-1212", location: "NYC" },
    summary: "Engineer.",
    experiences: [
      { title: "Eng", organization: "A", startDate: "2020", bullets: ["Grew revenue 30%", "Mentored peers"] },
      { title: "Dev", organization: "B", bullets: ["Shipped features"] },
    ],
    education: [{ institution: "Uni" }],
    skills: ["TS", "Go"],
  });
  const s = computeAtsSignals(resume);
  assert.equal(s.hasEmail, true);
  assert.equal(s.hasPhone, true);
  assert.equal(s.hasLocation, true);
  assert.equal(s.hasSummary, true);
  assert.equal(s.experienceCount, 2);
  assert.equal(s.educationCount, 1);
  assert.equal(s.skillCount, 2);
  assert.equal(s.bulletCount, 3);
  assert.equal(s.quantifiedBulletCount, 1); // only "Grew revenue 30%" has a number
  assert.equal(s.datedExperienceCount, 1); // only the first role has a start date
  assert.deepEqual(s.emptySections, []);
});

test("computeAtsSignals flags empty sections on a sparse resume", () => {
  const resume = parseOrThrow(ResumeModel, { contact: { name: "Min" } });
  const s = computeAtsSignals(resume);
  assert.equal(s.hasEmail, false);
  assert.equal(s.hasSummary, false);
  assert.equal(s.bulletCount, 0);
  assert.equal(s.quantifiedBulletCount, 0);
  assert.deepEqual(s.emptySections, ["summary", "experience", "education", "skills"]);
});

test("renderAtsSignals produces a readable ground-truth block", () => {
  const resume = parseOrThrow(ResumeModel, {
    contact: { name: "Jane", email: "j@x.com" },
    experiences: [{ title: "Eng", organization: "A", startDate: "2020", bullets: ["Did 5 things"] }],
    skills: ["TS"],
  });
  const block = renderAtsSignals(computeAtsSignals(resume));
  assert.match(block, /email: true/);
  assert.match(block, /quantified \(contain numbers\): 1/);
  assert.match(block, /Dated roles: 1\/1/);
  assert.match(block, /Empty\/missing sections: summary, education/);
});
