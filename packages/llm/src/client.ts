export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * The narrow capability the rest of the app depends on: turn a message list into
 * a completion string. Both {@link LlamaClient} and test fakes implement this, so
 * higher-level code (the prompt runner, resume structuring) never needs a live
 * model to be tested.
 */
export interface ChatClient {
  chatJson(messages: ChatMessage[]): Promise<string>;
  chatText(messages: ChatMessage[]): Promise<string>;
}

export interface LlamaOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  /** Bearer token for a llama-server started with --api-key. */
  apiKey?: string;
  /** Fixed RNG seed for reproducible output (default 0). */
  seed?: number;
  /** Cap on generated tokens — bounds runaway output (default 2048). */
  maxTokens?: number;
}

/**
 * Read an LLM env var. Canonical prefix is `LLM_`; the app talks to any
 * OpenAI-compatible server (llama.cpp, Ollama, vLLM), so the config surface is
 * model-agnostic. The legacy `LLAMA_` prefix is honored as a deprecated alias.
 */
export function llmEnv(suffix: string): string | undefined {
  return process.env[`LLM_${suffix}`] ?? process.env[`LLAMA_${suffix}`];
}

/**
 * Minimal client for an OpenAI-compatible chat-completions server. Pins
 * `temperature 0` + greedy decoding + a fixed seed so reviews are reproducible:
 * the same resume/job yields the same scores, and a re-review after an edit shows
 * a real delta rather than sampling noise. Ported from the sibling
 * `job-preparation` grader.
 */
export class LlamaClient implements ChatClient {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  apiKey: string | undefined;
  seed: number;
  maxTokens: number;

  constructor(o: LlamaOptions = {}) {
    // Endpoint precedence: explicit option → LLM_BASE_URL/LLAMA_BASE_URL →
    // LLM_SERVER_URL/LLAMA_SERVER_URL (the name used for a hosted llama server) →
    // local default. This lets the same code target a local model or a remote one.
    // A trailing slash is stripped so `.../v1/` doesn't become `.../v1//models`.
    const rawBaseUrl =
      o.baseUrl ?? llmEnv("BASE_URL") ?? llmEnv("SERVER_URL") ?? "http://localhost:8080/v1";
    this.baseUrl = rawBaseUrl.replace(/\/+$/, "");
    this.model = o.model ?? llmEnv("MODEL") ?? "local";
    // Default 10 minutes: a single generation (e.g. structuring a résumé) can be
    // very slow on a small CPU model or a busy remote server. Raise/lower via
    // LLM_TIMEOUT_MS.
    this.timeoutMs = o.timeoutMs ?? (Number(llmEnv("TIMEOUT_MS")) || 600000);
    this.apiKey = o.apiKey ?? llmEnv("API_KEY");
    this.seed = o.seed ?? (Number(llmEnv("SEED")) || 0);
    this.maxTokens = o.maxTokens ?? (Number(llmEnv("MAX_TOKENS")) || 2048);
  }

  /** Auth header for a secured llama-server (--api-key); empty when open. */
  private authHeaders(): Record<string, string> {
    return this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {};
  }

  private async timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }

  /** True if the endpoint is reachable. See {@link reach} for the reason. */
  async health(): Promise<boolean> {
    return (await this.reach()).ok;
  }

  /**
   * Detailed reachability probe. Tries `GET /models` first (cheap), then falls
   * back to a 1-token `POST /chat/completions` — some OpenAI-compatible servers
   * (and proxies) don't expose `/models` even though completions work. Uses a
   * generous timeout so a slower hosted endpoint over the web isn't reported as
   * offline. Returns a human-readable `detail` for diagnostics.
   */
  async reach(): Promise<{ ok: boolean; detail: string }> {
    // Well above the old 3s so a remote server has time to answer.
    const ms = Math.min(this.timeoutMs, 12000);
    try {
      const r = await this.timedFetch(`${this.baseUrl}/models`, { headers: this.authHeaders() }, ms);
      if (r.ok) return { ok: true, detail: `GET ${this.baseUrl}/models → ${r.status}` };

      const c = await this.timedFetch(
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", ...this.authHeaders() },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
            temperature: 0,
          }),
        },
        ms,
      );
      if (c.ok) return { ok: true, detail: `POST ${this.baseUrl}/chat/completions → ${c.status}` };

      const hint = r.status === 401 || c.status === 401 ? " — check your API key" : "";
      return {
        ok: false,
        detail: `${this.baseUrl}: /models → ${r.status}, /chat/completions → ${c.status}${hint}`,
      };
    } catch (e) {
      return { ok: false, detail: `cannot reach ${this.baseUrl}: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  /** Chat completion constrained to JSON output. Throws on network/HTTP error. */
  chatJson(messages: ChatMessage[]): Promise<string> {
    return this.chat(messages, true);
  }

  /** Chat completion with free-form (non-JSON) output. */
  chatText(messages: ChatMessage[]): Promise<string> {
    return this.chat(messages, false);
  }

  private async chat(messages: ChatMessage[], jsonMode: boolean): Promise<string> {
    // Deterministic decoding (temp 0, greedy) means a transient 5xx/timeout can be
    // retried to recover the SAME correct output. A 4xx (e.g. bad API key) is a
    // real client error and is surfaced immediately without retrying.
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt));
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", ...this.authHeaders() },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: 0,
            top_k: 1,
            seed: this.seed,
            max_tokens: this.maxTokens,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          return data.choices?.[0]?.message?.content ?? "";
        }
        if (res.status < 500) throw new Error(`llm-server responded ${res.status}`);
        lastErr = new Error(`llm-server responded ${res.status}`); // 5xx → retry
      } catch (e) {
        if (e instanceof Error && /responded 4\d\d/.test(e.message)) throw e; // client error
        // A timeout (our AbortController firing) is terminal: retrying just waits
        // another full timeout. Surface a clear, actionable message instead of the
        // bare "The operation was aborted".
        if (e instanceof Error && e.name === "AbortError") {
          throw new Error(
            `LLM request timed out after ${Math.round(this.timeoutMs / 1000)}s — the model at ` +
              `${this.baseUrl} did not respond in time. It may be a large/slow model or an ` +
              `overloaded server. Use a smaller/faster model, or raise LLM_TIMEOUT_MS ` +
              `(currently ${this.timeoutMs}).`,
          );
        }
        lastErr = e; // network error → retry
      } finally {
        clearTimeout(t);
      }
    }
    throw lastErr ?? new Error("chat: exhausted retries");
  }
}
