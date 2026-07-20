import { randomUUID } from "node:crypto";
import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { DiskCache } from "./disk-cache.js";

export interface CacheStats {
  /** Calls served from the cache (no model round-trip). */
  hits: number;
  /** Calls that ran the model and were then cached. */
  misses: number;
}

/** A call was SENT to the model (recorded immediately, before waiting). */
export interface LlmCallStart {
  phase: "start";
  /** Correlates with the matching `end` event. */
  id: string;
  at: string;
  kind: "json" | "text";
  model: string;
  /** The messages sent to the model. */
  messages: ChatMessage[];
}

/** A call RETURNED (or failed) — recorded when the response/error arrives. */
export interface LlmCallEnd {
  phase: "end";
  id: string;
  at: string;
  durationMs: number;
  /** True if served from cache (no model round-trip). */
  cached: boolean;
  /** The completion, or "" when the call failed. */
  completion: string;
  /** Set when the call threw (e.g. a timeout). */
  error?: string;
}

export type LlmCallEvent = LlmCallStart | LlmCallEnd;

/**
 * A {@link ChatClient} decorator that memoizes completions on disk. Because the
 * app pins `temperature 0` + a fixed seed, a given message list always yields the
 * same completion — so caching by a hash of (kind, model, messages) is safe and
 * makes every deterministic step (résumé structuring, reviews, per-requirement
 * scoring, …) instant the second time. It also acts as resumable progress: only
 * FAILED steps re-run, since only successful completions are cached.
 */
export class CachingChatClient implements ChatClient {
  readonly stats: CacheStats = { hits: 0, misses: 0 };

  constructor(
    private readonly inner: ChatClient,
    private readonly cache: DiskCache,
    /** Model tag folded into the cache key so switching models never returns stale results. */
    private readonly modelTag: string,
    /** Optional sink for an audit trail (best-effort; never throws into the call). */
    private readonly recorder?: (event: LlmCallEvent) => void,
  ) {}

  chatJson(messages: ChatMessage[]): Promise<string> {
    return this.memoize("json", messages, () => this.inner.chatJson(messages));
  }

  chatText(messages: ChatMessage[]): Promise<string> {
    return this.memoize("text", messages, () => this.inner.chatText(messages));
  }

  private async memoize(
    kind: "json" | "text",
    messages: ChatMessage[],
    produce: () => Promise<string>,
  ): Promise<string> {
    const key = DiskCache.hash("chat", kind, this.modelTag, JSON.stringify(messages));

    // Record that the call went out BEFORE waiting, so an in-flight (slow) call is
    // visible immediately in the audit.
    const id = randomUUID();
    this.emit({ phase: "start", id, at: new Date().toISOString(), kind, model: this.modelTag, messages });
    const started = Date.now();

    try {
      const cached = await this.cache.get(key);
      if (cached !== undefined) {
        this.stats.hits++;
        this.emit({ phase: "end", id, at: new Date().toISOString(), durationMs: Date.now() - started, cached: true, completion: cached });
        return cached;
      }
      // Only cache on success — a thrown timeout/error leaves nothing behind, so
      // the step re-runs next time (resumable progress).
      const out = await produce();
      this.stats.misses++;
      await this.cache.set(key, out);
      this.emit({ phase: "end", id, at: new Date().toISOString(), durationMs: Date.now() - started, cached: false, completion: out });
      return out;
    } catch (e) {
      // Record the failure (with how long we waited) so a timeout is visible too.
      this.emit({
        phase: "end",
        id,
        at: new Date().toISOString(),
        durationMs: Date.now() - started,
        cached: false,
        completion: "",
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  private emit(event: LlmCallEvent): void {
    if (!this.recorder) return;
    try {
      this.recorder(event);
    } catch {
      // auditing must never break a real call
    }
  }
}
