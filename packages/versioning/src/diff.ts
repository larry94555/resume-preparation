/**
 * Structured, field-level diff between two JSON-serializable values. This is the
 * heart of "review any change" (requirement 5): comparing two document versions
 * produces a flat list of path-addressed changes (e.g. `experiences[0].bullets[2]`)
 * — far more useful for a resume than a binary docx/pdf diff. Pure & deterministic.
 */

export type DiffType = "added" | "removed" | "changed";

export interface DiffEntry {
  /** Dotted/indexed path to the field, e.g. `contact.email` or `skills[3]`. */
  path: string;
  type: DiffType;
  /** Previous value (absent for "added"). */
  before?: unknown;
  /** New value (absent for "removed"). */
  after?: unknown;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function walk(a: unknown, b: unknown, path: string, out: DiffEntry[]): void {
  if (Object.is(a, b)) return;

  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const p = `${path}[${i}]`;
      if (i >= a.length) out.push({ path: p, type: "added", after: b[i] });
      else if (i >= b.length) out.push({ path: p, type: "removed", before: a[i] });
      else walk(a[i], b[i], p, out);
    }
    return;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in a)) out.push({ path: p, type: "added", after: b[k] });
      else if (!(k in b)) out.push({ path: p, type: "removed", before: a[k] });
      else walk(a[k], b[k], p, out);
    }
    return;
  }

  // Differing primitives, or a type change (object↔array↔primitive).
  out.push({ path: path || "(root)", type: "changed", before: a, after: b });
}

/** Compute the field-level differences turning `before` into `after`. */
export function diffStructured(before: unknown, after: unknown): DiffEntry[] {
  const out: DiffEntry[] = [];
  walk(before, after, "", out);
  return out;
}

/** Render a diff as human-readable lines (used by the explanation page / CLI). */
export function formatDiff(entries: DiffEntry[]): string[] {
  return entries.map((e) => {
    if (e.type === "added") return `+ ${e.path}: ${JSON.stringify(e.after)}`;
    if (e.type === "removed") return `- ${e.path}: ${JSON.stringify(e.before)}`;
    return `~ ${e.path}: ${JSON.stringify(e.before)} → ${JSON.stringify(e.after)}`;
  });
}
