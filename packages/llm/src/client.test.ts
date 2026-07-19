import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { LlamaClient, llmEnv } from "./client.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Build a minimal Response-like object for the stubbed fetch. */
function res(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function completion(content: string) {
  return { choices: [{ message: { content } }] };
}

test("chatJson posts deterministic params and returns the content", async () => {
  let sentBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sentBody = JSON.parse(init.body as string);
    return res(200, completion('{"ok":true}'));
  }) as typeof fetch;

  const client = new LlamaClient({ baseUrl: "http://x/v1", model: "m", seed: 7 });
  const out = await client.chatJson([{ role: "user", content: "hi" }]);
  assert.equal(out, '{"ok":true}');
  assert.equal(sentBody.temperature, 0);
  assert.equal(sentBody.seed, 7);
  assert.deepEqual(sentBody.response_format, { type: "json_object" });
});

test("chatText omits JSON response_format", async () => {
  let sentBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sentBody = JSON.parse(init.body as string);
    return res(200, completion("plain text"));
  }) as typeof fetch;

  const client = new LlamaClient({ baseUrl: "http://x/v1" });
  const out = await client.chatText([{ role: "user", content: "hi" }]);
  assert.equal(out, "plain text");
  assert.equal(sentBody.response_format, undefined);
});

test("a 4xx error is surfaced immediately without retrying", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return res(401, { error: "unauthorized" });
  }) as typeof fetch;

  const client = new LlamaClient({ baseUrl: "http://x/v1", apiKey: "wrong" });
  await assert.rejects(() => client.chatJson([{ role: "user", content: "hi" }]), /401/);
  assert.equal(calls, 1);
});

test("a transient 5xx is retried and then succeeds", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1 ? res(503, {}) : res(200, completion("recovered"));
  }) as typeof fetch;

  const client = new LlamaClient({ baseUrl: "http://x/v1" });
  const out = await client.chatJson([{ role: "user", content: "hi" }]);
  assert.equal(out, "recovered");
  assert.equal(calls, 2);
});

test("repeated 5xx exhausts retries and throws", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return res(502, {});
  }) as typeof fetch;

  const client = new LlamaClient({ baseUrl: "http://x/v1" });
  await assert.rejects(() => client.chatJson([{ role: "user", content: "hi" }]), /502/);
  assert.equal(calls, 3); // three attempts, then give up
});

test("health reflects endpoint reachability", async () => {
  globalThis.fetch = (async () => res(200, { data: [] })) as typeof fetch;
  const up = new LlamaClient({ baseUrl: "http://x/v1" });
  assert.equal(await up.health(), true);

  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;
  const down = new LlamaClient({ baseUrl: "http://x/v1" });
  assert.equal(await down.health(), false);
});

test("baseUrl falls back to LLM_/LLAMA_SERVER_URL when no BASE_URL is set", () => {
  const saved = {
    base: process.env.LLM_BASE_URL,
    lbase: process.env.LLAMA_BASE_URL,
    lserver: process.env.LLAMA_SERVER_URL,
    server: process.env.LLM_SERVER_URL,
  };
  try {
    delete process.env.LLM_BASE_URL;
    delete process.env.LLAMA_BASE_URL;
    delete process.env.LLM_SERVER_URL;
    process.env.LLAMA_SERVER_URL = "https://llm.example.com/v1";
    assert.equal(new LlamaClient().baseUrl, "https://llm.example.com/v1");
    // An explicit BASE_URL still wins over SERVER_URL.
    process.env.LLM_BASE_URL = "http://localhost:11434/v1";
    assert.equal(new LlamaClient().baseUrl, "http://localhost:11434/v1");
  } finally {
    for (const [k, v] of [
      ["LLM_BASE_URL", saved.base],
      ["LLAMA_BASE_URL", saved.lbase],
      ["LLAMA_SERVER_URL", saved.lserver],
      ["LLM_SERVER_URL", saved.server],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("llmEnv honors LLM_ then falls back to LLAMA_ alias", () => {
  const prevLlm = process.env.LLM_TESTKEY;
  const prevLlama = process.env.LLAMA_TESTKEY;
  try {
    delete process.env.LLM_TESTKEY;
    delete process.env.LLAMA_TESTKEY;
    assert.equal(llmEnv("TESTKEY"), undefined);
    process.env.LLAMA_TESTKEY = "legacy";
    assert.equal(llmEnv("TESTKEY"), "legacy");
    process.env.LLM_TESTKEY = "canonical";
    assert.equal(llmEnv("TESTKEY"), "canonical");
  } finally {
    if (prevLlm === undefined) delete process.env.LLM_TESTKEY;
    else process.env.LLM_TESTKEY = prevLlm;
    if (prevLlama === undefined) delete process.env.LLAMA_TESTKEY;
    else process.env.LLAMA_TESTKEY = prevLlama;
  }
});
