import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LlmCallEvent } from "@resume-prep/cache";

// Append-only NDJSON log of every model round-trip, under working/. Each call
// writes a "start" line when it is sent and an "end" line when it returns (or
// fails), so in-flight calls are visible immediately. Contains résumé/job text,
// so it lives in the gitignored working directory.
const FIELD_CAP = 40000; // cap each stored field so the log can't explode

// Kept in sync with engine.ts's workingDir() (inlined to avoid an import cycle).
function workingDir(): string {
  return process.env.WORKING_DIR ?? "working";
}
function auditFile(): string {
  return join(workingDir(), "audit.log");
}

/** A merged call (start + optional end) as shown on the audit page. */
export interface AuditEntry {
  id: string;
  at: string;
  kind: "json" | "text";
  model: string;
  system: string;
  user: string;
  /** True once the call has returned/failed. */
  done: boolean;
  cached?: boolean;
  durationMs?: number;
  completion?: string;
  error?: string;
}

async function appendLine(obj: unknown): Promise<void> {
  try {
    await mkdir(workingDir(), { recursive: true });
    await appendFile(auditFile(), `${JSON.stringify(obj)}\n`, "utf8");
  } catch {
    // auditing is best-effort
  }
}

/** A recorder that appends each model call's start/end to the audit log. */
export function auditRecorder(): (event: LlmCallEvent) => void {
  return (event) => {
    if (event.phase === "start") {
      void appendLine({
        phase: "start",
        id: event.id,
        at: event.at,
        kind: event.kind,
        model: event.model,
        system: (event.messages.find((m) => m.role === "system")?.content ?? "").slice(0, FIELD_CAP),
        user: event.messages
          .filter((m) => m.role !== "system")
          .map((m) => `[${m.role}] ${m.content}`)
          .join("\n")
          .slice(0, FIELD_CAP),
      });
    } else {
      void appendLine({
        phase: "end",
        id: event.id,
        at: event.at,
        durationMs: event.durationMs,
        cached: event.cached,
        completion: (event.completion ?? "").slice(0, FIELD_CAP),
        error: event.error,
      });
    }
  };
}

/** Read recent calls, merging each start with its end (oldest → newest by start). */
export async function readAudit(limit = 200): Promise<AuditEntry[]> {
  let text = "";
  try {
    text = await readFile(auditFile(), "utf8");
  } catch {
    return [];
  }

  const byId = new Map<string, AuditEntry>();
  const order: string[] = [];
  for (const line of text.split("\n").filter(Boolean)) {
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      continue; // skip a partially-written trailing line
    }
    if (ev.phase === "start") {
      byId.set(ev.id, {
        id: ev.id,
        at: ev.at,
        kind: ev.kind,
        model: ev.model,
        system: ev.system ?? "",
        user: ev.user ?? "",
        done: false,
      });
      order.push(ev.id);
    } else if (ev.phase === "end") {
      const entry = byId.get(ev.id);
      if (entry) {
        entry.done = true;
        entry.durationMs = ev.durationMs;
        entry.cached = ev.cached;
        entry.completion = ev.completion;
        entry.error = ev.error;
      }
    }
  }

  return order.map((id) => byId.get(id)).filter((e): e is AuditEntry => Boolean(e)).slice(-limit);
}

/** Clear the audit log. */
export async function clearAudit(): Promise<void> {
  try {
    await writeFile(auditFile(), "", "utf8");
  } catch {
    // ignore
  }
}
