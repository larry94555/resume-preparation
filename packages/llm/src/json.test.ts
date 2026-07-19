import assert from "node:assert/strict";
import { test } from "node:test";
import { extractJsonObject, tryParseJson } from "./json.js";

test("extractJsonObject returns a clean object unchanged", () => {
  assert.equal(extractJsonObject('{"a":1}'), '{"a":1}');
});

test("extractJsonObject strips code fences", () => {
  assert.equal(extractJsonObject('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJsonObject('```\n{"a":1}\n```'), '{"a":1}');
});

test("extractJsonObject ignores prose before/after the object", () => {
  assert.equal(
    extractJsonObject('Sure! Here is the result:\n{"a":1}\nHope that helps.'),
    '{"a":1}',
  );
});

test("extractJsonObject respects braces inside strings", () => {
  const s = '{"text":"a } b { c","n":2}';
  assert.equal(extractJsonObject(s), s);
});

test("extractJsonObject handles nested objects", () => {
  const s = '{"a":{"b":{"c":1}},"d":2}';
  assert.equal(extractJsonObject(s), s);
});

test("extractJsonObject handles escaped quotes inside strings", () => {
  const s = '{"q":"she said \\"hi\\" }"}';
  assert.equal(extractJsonObject(s), s);
});

test("extractJsonObject returns null when no object is present", () => {
  assert.equal(extractJsonObject("no json here"), null);
  assert.equal(extractJsonObject(""), null);
  assert.equal(extractJsonObject("{ unterminated"), null);
});

test("tryParseJson parses or returns null", () => {
  assert.deepEqual(tryParseJson('prefix {"a":1} suffix'), { a: 1 });
  assert.equal(tryParseJson("not json"), null);
  assert.equal(tryParseJson('{"a": }'), null);
});
