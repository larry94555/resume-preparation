import assert from "node:assert/strict";
import { test } from "node:test";
import type { LinkedInChangeSet } from "@resume-prep/schema";
import { applyLinkedInChanges, type AssistedFillDriver } from "./assisted-fill.js";

const CHANGES: LinkedInChangeSet = {
  summary: "Two changes.",
  changes: [
    { field: "headline", suggested: "Backend Engineer | Distributed Systems", instructions: "Edit intro" },
    { field: "about", suggested: "I build reliable systems.", instructions: "Edit About" },
  ],
};

/** Mock driver that records what it was asked to fill. */
class MockDriver implements AssistedFillDriver {
  filled: Array<[string, string]> = [];
  async fillField(field: string, value: string): Promise<void> {
    this.filled.push([field, value]);
  }
}

test("applyLinkedInChanges refuses when not explicitly enabled", async () => {
  const driver = new MockDriver();
  await assert.rejects(
    () => applyLinkedInChanges(CHANGES, driver, { enabled: false }),
    /assisted fill is disabled/,
  );
  assert.equal(driver.filled.length, 0);
});

test("applyLinkedInChanges skips everything by default (confirm rejects)", async () => {
  const driver = new MockDriver();
  const result = await applyLinkedInChanges(CHANGES, driver, { enabled: true });
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.skipped, ["headline", "about"]);
  assert.equal(driver.filled.length, 0);
});

test("applyLinkedInChanges applies only confirmed changes", async () => {
  const driver = new MockDriver();
  const result = await applyLinkedInChanges(CHANGES, driver, {
    enabled: true,
    confirm: (c) => c.field === "headline", // approve headline only
  });
  assert.deepEqual(result.applied, ["headline"]);
  assert.deepEqual(result.skipped, ["about"]);
  assert.deepEqual(driver.filled, [["headline", "Backend Engineer | Distributed Systems"]]);
});
