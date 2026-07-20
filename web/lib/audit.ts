import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LlmCallRecord } from "@resume-prep/cache";

// Append-only NDJSON log of every model round-trip, under working/. Contains
// résumé/job text, so it lives in the gitignored working directory.
const FIELD_CAP = 40000; // cap each stored field so the log can't explode

// Kept in sync with engine.ts's workingDir() (inlined to avoid an import cycle).
function workingDir(): string {
  return process.env.WORKING_DIR ?? "working";
}
function auditFile(): string {
  return join(workingDir(), "audit.log");
}

/** One line as stored (prompt flattened to system/user for display). */
export interface AuditEntry {
  at: string;
  kind: "json" | "text";
  model: string;
  cached: boolean;
  durationMs: number;
  system: string;
  user: string;
  completion: string;
}

/** A recorder that appends each model call to the audit log (best-effort). */
export function auditRecorder(): (record: LlmCallRecord) => void {
  return (r) => {
    void (async () => {
      try {
        await mkdir(workingDir(), { recursive: true });
        const entry: AuditEntry = {
          at: r.at,
          kind: r.kind,
          model: r.model,
          cached: r.cached,
          durationMs: r.durationMs,
          system: (r.messages.find((m) => m.role === "system")?.content ?? "").slice(0, FIELD_CAP),
          user: r.messages
            .filter((m) => m.role !== "system")
            .map((m) => `[${m.role}] ${m.content}`)
            .join("\n")
            .slice(0, FIELD_CAP),
          completion: r.completion.slice(0, FIELD_CAP),
        };
        await appendFile(auditFile(), `${JSON.stringify(entry)}\n`, "utf8");
      } catch {
        // auditing is best-effort
      }
    })();
  };
}

/** Read the most recent audit entries (chronological, oldest → newest). */
export async function readAudit(limit = 200): Promise<AuditEntry[]> {
  let text = "";
  try {
    text = await readFile(auditFile(), "utf8");
  } catch {
    return [];
  }
  const lines = text.split("\n").filter(Boolean).slice(-limit);
  const out: AuditEntry[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as AuditEntry);
    } catch {
      // skip a partially-written trailing line
    }
  }
  return out;
}

/** Clear the audit log. */
export async function clearAudit(): Promise<void> {
  try {
    await writeFile(auditFile(), "", "utf8");
  } catch {
    // ignore
  }
}
