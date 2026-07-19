import assert from "node:assert/strict";
import { test } from "node:test";
import { diffStructured, formatDiff } from "./diff.js";

test("diffStructured returns no entries for equal values", () => {
  assert.deepEqual(diffStructured({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }), []);
});

test("diffStructured reports changed, added, and removed object fields", () => {
  const before = { name: "Jane", email: "a@x.com", phone: "555" };
  const after = { name: "Jane R.", email: "a@x.com", location: "NYC" };
  const d = diffStructured(before, after);
  assert.deepEqual(d, [
    { path: "location", type: "added", after: "NYC" },
    { path: "name", type: "changed", before: "Jane", after: "Jane R." },
    { path: "phone", type: "removed", before: "555" },
  ]);
});

test("diffStructured recurses into nested paths and arrays", () => {
  const before = { skills: ["TS", "Go"], contact: { email: "a@x.com" } };
  const after = { skills: ["TS", "Rust", "Python"], contact: { email: "b@x.com" } };
  const d = diffStructured(before, after);
  assert.deepEqual(d, [
    { path: "contact.email", type: "changed", before: "a@x.com", after: "b@x.com" },
    { path: "skills[1]", type: "changed", before: "Go", after: "Rust" },
    { path: "skills[2]", type: "added", after: "Python" },
  ]);
});

test("diffStructured treats a type change as a change at the path", () => {
  const d = diffStructured({ x: { a: 1 } }, { x: [1] });
  assert.deepEqual(d, [{ path: "x", type: "changed", before: { a: 1 }, after: [1] }]);
});

test("formatDiff renders +/-/~ lines", () => {
  const lines = formatDiff([
    { path: "skills[2]", type: "added", after: "Python" },
    { path: "phone", type: "removed", before: "555" },
    { path: "name", type: "changed", before: "Jane", after: "Jane R." },
  ]);
  assert.deepEqual(lines, [
    `+ skills[2]: "Python"`,
    `- phone: "555"`,
    `~ name: "Jane" → "Jane R."`,
  ]);
});
