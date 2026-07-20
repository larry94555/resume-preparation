import type { ChatClient, ChatMessage } from "@resume-prep/llm";
import { DiskCache } from "./disk-cache.js";

export interface CacheStats {
  /** Calls served from the cache (no model round-trip). */
  hits: number;
  /** Calls that ran the model and were then cached. */
  misses: number;
}

/** One recorded model round-trip, for an audit trail. */
export interface LlmCallRecord {
  /** ISO timestamp when the call completed. */
  at: string;
  kind: "json" | "text";
  model: string;
  /** True if served from cache (no model round-trip). */
  cached: boolean;
  durationMs: number;
  /** The messages sent to the model. */
  messages: ChatMessage[];
  /** The completion returned. */
  completion: string;
}

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
    /** Optional sink for an audit trail of every call (best-effort; never throws into the call). */
    private readonly recorder?: (record: LlmCallRecord) => void,
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
    const start = Date.now();
    const key = DiskCache.hash("chat", kind, this.modelTag, JSON.stringify(messages));
    const cached = await this.cache.get(key);
    if (cached !== undefined) {
      this.stats.hits++;
      this.record(kind, messages, cached, true, Date.now() - start);
      return cached;
    }
    // Only cache on success — a thrown timeout/error leaves nothing behind, so the
    // step re-runs next time (resumable progress).
    const out = await produce();
    this.stats.misses++;
    await this.cache.set(key, out);
    this.record(kind, messages, out, false, Date.now() - start);
    return out;
  }

  private record(
    kind: "json" | "text",
    messages: ChatMessage[],
    completion: string,
    cached: boolean,
    durationMs: number,
  ): void {
    if (!this.recorder) return;
    try {
      this.recorder({ at: new Date().toISOString(), kind, model: this.modelTag, cached, durationMs, messages, completion });
    } catch {
      // auditing must never break a real call
    }
  }
}
