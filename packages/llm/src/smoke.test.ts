import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { LlamaClient } from "./client.js";
import { runStructured } from "./runner.js";

/**
 * Live-endpoint smoke test. It SELF-SKIPS when no model server is reachable
 * (e.g. in CI), so it is safe on every PR; run it locally against your
 * llama-server / Ollama to confirm end-to-end structured extraction works.
 */
test("live model returns schema-valid JSON (skips if no endpoint)", async (t) => {
  const client = new LlamaClient();
  if (!(await client.health())) {
    t.skip("no LLM endpoint reachable (set LLM_BASE_URL to run this)");
    return;
  }

  const schema = z.object({ capital: z.string() });
  const out = await runStructured(client, {
    system: "You answer with a single JSON object and nothing else.",
    user: 'Return the capital of France as {"capital": "..."}.',
    schema,
  });
  assert.ok(out.capital.length > 0);
});
