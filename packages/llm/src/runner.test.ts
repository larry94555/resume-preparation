import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import type { ChatClient, ChatMessage } from "./client.js";
import { runStructured, StructuredOutputError } from "./runner.js";

/** A ChatClient that replays a fixed list of completions, recording the prompts. */
class ScriptedClient implements ChatClient {
  calls: ChatMessage[][] = [];
  constructor(private readonly replies: string[]) {}
  async chatJson(messages: ChatMessage[]): Promise<string> {
    this.calls.push(messages);
    return this.replies[this.calls.length - 1] ?? "";
  }
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chatJson(messages);
  }
}

const Person = z.object({ name: z.string(), age: z.number() });

test("runStructured returns a validated value on the first try", async () => {
  const client = new ScriptedClient(['{"name":"Jane","age":30}']);
  const out = await runStructured(client, {
    system: "You extract people.",
    user: "Jane is 30.",
    schema: Person,
  });
  assert.deepEqual(out, { name: "Jane", age: 30 });
  // system + user were both sent.
  assert.equal(client.calls[0]?.length, 2);
});

test("runStructured repairs invalid JSON then succeeds", async () => {
  const client = new ScriptedClient([
    "sorry, no json this time",
    '{"name":"Bob","age":41}',
  ]);
  const out = await runStructured(client, { user: "Bob is 41.", schema: Person });
  assert.deepEqual(out, { name: "Bob", age: 41 });
  // Second attempt carries the assistant reply + a repair instruction.
  const secondPrompt = client.calls[1] ?? [];
  assert.equal(secondPrompt.at(-1)?.role, "user");
  assert.match(secondPrompt.at(-1)?.content ?? "", /JSON object/);
});

test("runStructured repairs a schema mismatch using the validation error", async () => {
  const client = new ScriptedClient([
    '{"name":"Cy"}', // missing age
    '{"name":"Cy","age":22}',
  ]);
  const out = await runStructured(client, { user: "Cy is 22.", schema: Person });
  assert.deepEqual(out, { name: "Cy", age: 22 });
  const repairMsg = client.calls[1]?.at(-1)?.content ?? "";
  assert.match(repairMsg, /age/);
});

test("runStructured repairs unparseable JSON-looking output", async () => {
  // extractJsonObject finds a {...} block, but it isn't valid JSON, so the parse
  // step fails and a repair is requested.
  const client = new ScriptedClient(["{ name: Jane, age: 30 }", '{"name":"Jane","age":30}']);
  const out = await runStructured(client, { user: "x", schema: Person });
  assert.deepEqual(out, { name: "Jane", age: 30 });
  assert.match(client.calls[1]?.at(-1)?.content ?? "", /could not be parsed/);
});

test("runStructured throws StructuredOutputError after exhausting repairs", async () => {
  const client = new ScriptedClient(["nope", "still nope", "nope again", "and again"]);
  await assert.rejects(
    () => runStructured(client, { user: "x", schema: Person, maxRepairs: 2 }),
    (err: unknown) => {
      assert.ok(err instanceof StructuredOutputError);
      assert.equal(err.lastRaw, "nope again"); // 3rd (last) attempt with maxRepairs=2
      return true;
    },
  );
  // maxRepairs=2 → 3 attempts total.
  assert.equal(client.calls.length, 3);
});
