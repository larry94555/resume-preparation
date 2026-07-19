import assert from "node:assert/strict";
import { test } from "node:test";
import { ResumeModel } from "./resume.js";
import { SourceDocument } from "./document.js";
import { parseOrThrow, validate } from "./validate.js";

test("ResumeModel fills array defaults and requires a contact name", () => {
  const result = validate(ResumeModel, {
    contact: { name: "Jane Developer", email: "jane@example.com" },
    summary: "Backend engineer.",
    experiences: [
      { title: "Engineer", organization: "Acme", bullets: ["Built things"] },
    ],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    // Defaulted collections are present even though the input omitted them.
    assert.deepEqual(result.value.skills, []);
    assert.deepEqual(result.value.education, []);
    assert.deepEqual(result.value.certifications, []);
    assert.deepEqual(result.value.projects, []);
    // Nested defaults apply too.
    assert.deepEqual(result.value.experiences[0]?.bullets, ["Built things"]);
    assert.equal(result.value.contact.links.length, 0);
  }
});

test("ResumeModel rejects a missing contact name with a readable error", () => {
  const result = validate(ResumeModel, { contact: { email: "x@y.z" } });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /contact\.name/);
  }
});

test("parseOrThrow throws on invalid data and returns typed value on success", () => {
  assert.throws(() => parseOrThrow(ResumeModel, { contact: {} }), /validation failed/);
  const doc = parseOrThrow(SourceDocument, {
    kind: "resume",
    format: "pdf",
    text: "hello",
  });
  assert.equal(doc.kind, "resume");
  assert.equal(doc.format, "pdf");
});

test("SourceDocument rejects an unknown format", () => {
  const result = validate(SourceDocument, {
    kind: "resume",
    format: "rtf",
    text: "x",
  });
  assert.equal(result.ok, false);
});
