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
    this.baseUrl = o.baseUrl ?? llmEnv("BASE_URL") ?? "http://localhost:8080/v1";
    this.model = o.model ?? llmEnv("MODEL") ?? "local";
    this.timeoutMs = o.timeoutMs ?? (Number(llmEnv("TIMEOUT_MS")) || 60000);
    this.apiKey = o.apiKey ?? llmEnv("API_KEY");
    this.seed = o.seed ?? (Number(llmEnv("SEED")) || 0);
    this.maxTokens = o.maxTokens ?? (Number(llmEnv("MAX_TOKENS")) || 2048);
  }

  /** Auth header for a secured llama-server (--api-key); empty when open. */
  private authHeaders(): Record<string, string> {
    return this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {};
  }

  /** True if the server answers a models/health probe quickly. */
  async health(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${this.baseUrl}/models`, {
        signal: ctrl.signal,
        headers: this.authHeaders(),
      });
      clearTimeout(t);
      return r.ok;
    } catch {
      return false;
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
        if (e instanceof Error && /responded 4\d\d/.test(e.message)) throw e;
        lastErr = e; // network error / timeout → retry
      } finally {
        clearTimeout(t);
      }
    }
    throw lastErr ?? new Error("chat: exhausted retries");
  }
}
