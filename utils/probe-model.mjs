// Dependency-free "is the model reachable?" probe, shared by `secrets:check` and
// `check`. Mirrors LlamaClient.reach(): tries GET /models, then a 1-token chat
// completion (some servers don't expose /models even though completions work).
// Reads the same env the client does (after utils/load-secrets.mjs has run).

function baseUrl() {
  const raw =
    process.env.LLM_BASE_URL ??
    process.env.LLAMA_BASE_URL ??
    process.env.LLM_SERVER_URL ??
    process.env.LLAMA_SERVER_URL ??
    "";
  return raw.replace(/\/+$/, "");
}

async function timedFetch(url, init, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Returns { ok, baseUrl, detail }. Never throws. */
export async function probeModel({ timeoutMs = 10000 } = {}) {
  const base = baseUrl();
  if (!base) {
    return { ok: false, baseUrl: "", detail: "LLM_BASE_URL is not set (configure secrets/secrets.env)." };
  }
  const apiKey = process.env.LLM_API_KEY ?? process.env.API_KEY;
  const auth = apiKey ? { authorization: `Bearer ${apiKey}` } : {};
  const model = process.env.LLM_MODEL ?? "local";

  try {
    const r = await timedFetch(`${base}/models`, { headers: auth }, timeoutMs);
    if (r.ok) return { ok: true, baseUrl: base, detail: `GET ${base}/models → ${r.status}` };

    const c = await timedFetch(
      `${base}/chat/completions`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...auth },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1, temperature: 0 }),
      },
      timeoutMs,
    );
    if (c.ok) return { ok: true, baseUrl: base, detail: `POST ${base}/chat/completions → ${c.status}` };

    const hint = r.status === 401 || c.status === 401 ? " (401 — check API_KEY)" : "";
    return { ok: false, baseUrl: base, detail: `/models → ${r.status}, /chat/completions → ${c.status}${hint}` };
  } catch (e) {
    return { ok: false, baseUrl: base, detail: `cannot connect: ${e?.message ?? e}` };
  }
}
