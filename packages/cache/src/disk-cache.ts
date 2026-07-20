import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * A tiny content-addressed cache on disk. Values are stored one file per key
 * under `dir`, named by the key (a hash). Used to memoize deterministic LLM
 * calls so completed work is never repeated (see {@link CachingChatClient}).
 */
export class DiskCache {
  constructor(private readonly dir: string) {}

  /** Stable SHA-256 hex of the given parts (NUL-separated so parts can't blur). */
  static hash(...parts: string[]): string {
    const h = createHash("sha256");
    for (const p of parts) {
      h.update(p);
      h.update("\0");
    }
    return h.digest("hex");
  }

  private file(key: string): string {
    return join(this.dir, `${key}.txt`);
  }

  /** Read a cached value, or undefined on a miss. */
  async get(key: string): Promise<string | undefined> {
    try {
      return await readFile(this.file(key), "utf8");
    } catch {
      return undefined;
    }
  }

  /** Write a value (creating the directory as needed). */
  async set(key: string, value: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(key), value, "utf8");
  }
}
