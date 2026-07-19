import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_JOB_TEXT_CHARS, prepareUntrustedJobText } from "./sanitize.js";

test("prepareUntrustedJobText collapses whitespace and blank runs", () => {
  const out = prepareUntrustedJobText("A\t role   here\r\n\n\n\n with   spaces  ");
  assert.equal(out, "A role here\n\nwith spaces");
});

test("prepareUntrustedJobText caps very long input", () => {
  const huge = "x".repeat(MAX_JOB_TEXT_CHARS + 5000);
  const out = prepareUntrustedJobText(huge);
  assert.ok(out.length <= MAX_JOB_TEXT_CHARS + 20);
  assert.match(out, /\[\.\.\.truncated\]$/);
});
