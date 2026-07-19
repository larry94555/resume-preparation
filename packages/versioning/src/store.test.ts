import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { SnapshotStore } from "./store.js";

let dir: string;
let seq: number;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rp-versioning-"));
  seq = 0;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Deterministic store: monotonic ids and an increasing clock. */
function makeStore() {
  return new SnapshotStore({
    dir,
    genId: () => `v${++seq}`,
    now: () => `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
  });
}

test("save auto-chains onto the target head and history is ordered", async () => {
  const store = makeStore();
  const v1 = await store.save({ target: "resume", kind: "resume", content: { skills: ["TS"] } });
  const v2 = await store.save({
    target: "resume",
    kind: "resume",
    content: { skills: ["TS", "Go"] },
    source: "generated",
  });

  assert.equal(v1.parentId, null);
  assert.equal(v2.parentId, "v1");
  assert.equal(v2.source, "generated");

  const history = await store.history("resume");
  assert.deepEqual(history.map((s) => s.id), ["v1", "v2"]);
  assert.equal((await store.head("resume"))?.id, "v2");
});

test("get reads a snapshot back from disk across targets", async () => {
  const store = makeStore();
  await store.save({ target: "resume", kind: "resume", content: { a: 1 } });
  const cover = await store.save({ target: "cover-letter:acme", kind: "cover_letter", content: { text: "hi" } });

  const fetched = await store.get(cover.id);
  assert.equal(fetched.target, "cover-letter:acme");
  assert.deepEqual(fetched.content, { text: "hi" });
  await assert.rejects(() => store.get("nope"), /snapshot not found/);
});

test("diff compares two snapshots' content structurally", async () => {
  const store = makeStore();
  const v1 = await store.save({ target: "resume", kind: "resume", content: { skills: ["TS"] } });
  const v2 = await store.save({ target: "resume", kind: "resume", content: { skills: ["TS", "Go"] } });
  const d = await store.diff(v1.id, v2.id);
  assert.deepEqual(d, [{ path: "skills[1]", type: "added", after: "Go" }]);
});

test("revert appends a new snapshot with the old content (history preserved)", async () => {
  const store = makeStore();
  const v1 = await store.save({ target: "resume", kind: "resume", content: { skills: ["TS"] } });
  await store.save({ target: "resume", kind: "resume", content: { skills: ["TS", "Go", "Rust"] } });

  const reverted = await store.revert(v1.id);
  assert.equal(reverted.source, "reverted");
  assert.equal(reverted.parentId, "v2"); // chains onto the head, not a rewrite
  assert.deepEqual(reverted.content, { skills: ["TS"] });
  assert.match(reverted.note ?? "", /revert to v1/);

  // Full history is intact: v1, v2, v3(reverted).
  const history = await store.history("resume");
  assert.deepEqual(history.map((s) => s.id), ["v1", "v2", "v3"]);
});

test("history is empty for an unknown target", async () => {
  const store = makeStore();
  assert.deepEqual(await store.history("nothing"), []);
  assert.equal(await store.head("nothing"), null);
});

test("default id/clock produce a usable snapshot", async () => {
  const store = new SnapshotStore({ dir }); // no injected genId/now
  const snap = await store.save({ target: "resume", kind: "resume", content: { a: 1 } });
  assert.ok(snap.id.length > 0);
  assert.ok(!Number.isNaN(Date.parse(snap.createdAt)));
  assert.equal((await store.get(snap.id)).id, snap.id);
});
