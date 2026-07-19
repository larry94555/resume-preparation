import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { diffStructured, type DiffEntry } from "./diff.js";

/** Where a version came from. */
export type SnapshotSource = "user" | "generated" | "reverted";

/** One immutable version of a document/recommendation. */
export interface Snapshot {
  id: string;
  /** Logical document key, e.g. "resume" or "cover-letter:acme". */
  target: string;
  /** Free-form type tag, e.g. "resume" | "cover_letter" | "review". */
  kind: string;
  /** Parent version in the history chain (null for the first). */
  parentId: string | null;
  createdAt: string;
  source: SnapshotSource;
  label?: string;
  note?: string;
  /** The versioned content (JSON-serializable). */
  content: unknown;
}

export interface SaveInput {
  target: string;
  kind: string;
  content: unknown;
  source?: SnapshotSource;
  /** Override the parent; omit to auto-chain onto the target's current head. */
  parentId?: string | null;
  label?: string;
  note?: string;
}

export interface SnapshotStoreOptions {
  /** Root directory for the store (contains one subdirectory per target). */
  dir: string;
  /** Clock, injectable for deterministic tests. Defaults to ISO now. */
  now?: () => string;
  /** ID generator, injectable for deterministic tests. */
  genId?: () => string;
}

function safeTarget(target: string): string {
  return target.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function defaultGenId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Append-only, file-based snapshot store (requirement 5). Every change to a
 * document is written as a new immutable JSON file; nothing is ever rewritten, so
 * the full history is auditable. Reverting creates a NEW snapshot whose content
 * equals an older one. Diffs are structural (field-level), not binary.
 */
export class SnapshotStore {
  private readonly dir: string;
  private readonly now: () => string;
  private readonly genId: () => string;

  constructor(opts: SnapshotStoreOptions) {
    this.dir = opts.dir;
    this.now = opts.now ?? (() => new Date().toISOString());
    this.genId = opts.genId ?? defaultGenId;
  }

  private targetDir(target: string): string {
    return join(this.dir, safeTarget(target));
  }

  /** Save a new snapshot, auto-chaining onto the target's head unless told otherwise. */
  async save(input: SaveInput): Promise<Snapshot> {
    const dir = this.targetDir(input.target);
    await mkdir(dir, { recursive: true });

    const parentId =
      input.parentId !== undefined ? input.parentId : (await this.head(input.target))?.id ?? null;

    const snapshot: Snapshot = {
      id: this.genId(),
      target: input.target,
      kind: input.kind,
      parentId,
      createdAt: this.now(),
      source: input.source ?? "user",
      content: input.content,
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    };

    await writeFile(join(dir, `${snapshot.id}.json`), JSON.stringify(snapshot, null, 2), "utf8");
    return snapshot;
  }

  /** All snapshots for a target, oldest → newest. Empty if the target is unknown. */
  async history(target: string): Promise<Snapshot[]> {
    const dir = this.targetDir(target);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }
    const snaps: Snapshot[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      snaps.push(JSON.parse(await readFile(join(dir, f), "utf8")) as Snapshot);
    }
    snaps.sort((a, b) =>
      a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt),
    );
    return snaps;
  }

  /** The newest snapshot for a target, or null if there is none. */
  async head(target: string): Promise<Snapshot | null> {
    const all = await this.history(target);
    return all.length ? (all[all.length - 1] as Snapshot) : null;
  }

  /** Fetch a single snapshot by id (searches all targets). Throws if not found. */
  async get(id: string): Promise<Snapshot> {
    let targets: string[];
    try {
      targets = await readdir(this.dir);
    } catch {
      throw new Error(`snapshot not found: ${id}`);
    }
    for (const t of targets) {
      try {
        const raw = await readFile(join(this.dir, t, `${id}.json`), "utf8");
        return JSON.parse(raw) as Snapshot;
      } catch {
        // not in this target dir; keep looking
      }
    }
    throw new Error(`snapshot not found: ${id}`);
  }

  /** Field-level diff between two snapshots' content. */
  async diff(fromId: string, toId: string): Promise<DiffEntry[]> {
    const [from, to] = await Promise.all([this.get(fromId), this.get(toId)]);
    return diffStructured(from.content, to.content);
  }

  /**
   * Revert a target to an earlier snapshot's content by appending a NEW snapshot
   * (history is never rewritten). The new snapshot chains onto the current head.
   */
  async revert(id: string): Promise<Snapshot> {
    const target = await this.get(id);
    return this.save({
      target: target.target,
      kind: target.kind,
      content: target.content,
      source: "reverted",
      note: `revert to ${id}`,
    });
  }
}
