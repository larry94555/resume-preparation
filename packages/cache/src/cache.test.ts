import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { CachingChatClient } from "./caching-client.js";
import { DiskCache } from "./disk-cache.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rp-cache-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("DiskCache.hash is stable and input-sensitive", () => {
  assert.equal(DiskCache.hash("a", "b"), DiskCache.hash("a", "b"));
  assert.notEqual(DiskCache.hash("a", "b"), DiskCache.hash("ab", ""));
  assert.notEqual(DiskCache.hash("a"), DiskCache.hash("b"));
});

test("DiskCache round-trips values and misses on unknown keys", async () => {
  const cache = new DiskCache(dir);
  assert.equal(await cache.get("nope"), undefined);
  await cache.set("k", "hello");
  assert.equal(await cache.get("k"), "hello");
});

/** A ChatClient that records how many times it was actually invoked. */
class CountingClient implements ChatClient {
  calls = 0;
  async chatJson(_messages: ChatMessage[]): Promise<string> {
    this.calls++;
    return `reply-${this.calls}`;
  }
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatJson(messages);
  }
}

test("CachingChatClient serves repeated identical calls from cache", async () => {
  const inner = new CountingClient();
  const client = new CachingChatClient(inner, new DiskCache(dir), "test-model");
  const msgs: ChatMessage[] = [{ role: "user", content: "hi" }];

  const first = await client.chatJson(msgs);
  const second = await client.chatJson(msgs);
  assert.equal(first, "reply-1");
  assert.equal(second, "reply-1"); // same cached value, model NOT called again
  assert.equal(inner.calls, 1);
  assert.deepEqual(client.stats, { hits: 1, misses: 1 });

  // A different message is a miss and hits the model.
  await client.chatJson([{ role: "user", content: "different" }]);
  assert.equal(inner.calls, 2);
  assert.deepEqual(client.stats, { hits: 1, misses: 2 });
});

test("CachingChatClient caches chatText independently from chatJson", async () => {
  const inner = new CountingClient();
  const client = new CachingChatClient(inner, new DiskCache(dir), "m");
  const msgs: ChatMessage[] = [{ role: "user", content: "hi" }];

  await client.chatText(msgs);
  await client.chatText(msgs); // second is a cache hit
  assert.equal(inner.calls, 1);
  // chatJson uses a different cache namespace, so it misses (calls the model).
  await client.chatJson(msgs);
  assert.equal(inner.calls, 2);
});

test("CachingChatClient records each call (with the cached flag) for auditing", async () => {
  const records: Array<{ cached: boolean; completion: string; kind: string }> = [];
  const client = new CachingChatClient(new CountingClient(), new DiskCache(dir), "m", (r) =>
    records.push({ cached: r.cached, completion: r.completion, kind: r.kind }),
  );
  const msgs: ChatMessage[] = [{ role: "user", content: "hi" }];

  await client.chatJson(msgs); // miss
  await client.chatJson(msgs); // hit
  assert.equal(records.length, 2);
  assert.equal(records[0]?.cached, false);
  assert.equal(records[1]?.cached, true);
  assert.equal(records[0]?.completion, records[1]?.completion);
  assert.equal(records[0]?.kind, "json");
});

test("CachingChatClient keys on the model tag (no cross-model bleed)", async () => {
  const inner = new CountingClient();
  const cache = new DiskCache(dir);
  const a = new CachingChatClient(inner, cache, "model-a");
  const b = new CachingChatClient(inner, cache, "model-b");
  const msgs: ChatMessage[] = [{ role: "user", content: "hi" }];

  await a.chatJson(msgs);
  await b.chatJson(msgs); // different model tag → miss → model called again
  assert.equal(inner.calls, 2);
});

test("CachingChatClient does not cache a thrown error (resumable progress)", async () => {
  let attempt = 0;
  const flaky: ChatClient = {
    async chatJson() {
      attempt++;
      if (attempt === 1) throw new Error("timeout");
      return "recovered";
    },
    chatText(m) {
      return this.chatJson(m);
    },
  };
  const client = new CachingChatClient(flaky, new DiskCache(dir), "m");
  const msgs: ChatMessage[] = [{ role: "user", content: "hi" }];

  await assert.rejects(() => client.chatJson(msgs), /timeout/);
  // The failure wasn't cached, so a retry runs the model again and succeeds.
  assert.equal(await client.chatJson(msgs), "recovered");
});
