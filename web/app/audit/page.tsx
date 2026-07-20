"use client";

import { useCallback, useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  at: string;
  kind: "json" | "text";
  model: string;
  system: string;
  user: string;
  done: boolean;
  cached?: boolean;
  durationMs?: number;
  completion?: string;
  error?: string;
}

function fmtDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [auto, setAuto] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const d = await (await fetch("/api/audit")).json();
      setEntries(d.entries ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      setNow(Date.now());
      refresh();
    }, 1500);
    return () => clearInterval(id);
  }, [auto, refresh]);

  const clear = async () => {
    await fetch("/api/audit", { method: "DELETE" });
    refresh();
  };

  const rows = [...entries].reverse(); // newest first
  const inflight = entries.filter((e) => !e.done).length;

  return (
    <main>
      <h1>LLM Audit</h1>
      <p className="muted">
        Every request/response between the app and the model, in order — each call
        appears the moment it is sent, with how long the reply took. {entries.length}{" "}
        call(s){inflight > 0 ? `, ${inflight} in flight` : ""}.
      </p>

      <div className="row">
        <button onClick={refresh}>Refresh</button>
        <label>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-refresh
        </label>
        <button className="secondary" onClick={clear}>Clear log</button>
      </div>

      {error && <p className="error">⚠ {error}</p>}
      {entries.length === 0 && (
        <p className="muted">No calls yet. Reload the home page (runs a hello test) or start an analysis.</p>
      )}

      {rows.map((e) => {
        const badge = !e.done ? "sent" : e.error ? "error" : e.cached ? "cached" : "model";
        const badgeClass = e.error ? "error" : e.done && !e.error ? (e.cached ? "ok" : "") : "";
        const elapsed = e.done ? fmtDuration(e.durationMs ?? 0) : `${((now - new Date(e.at).getTime()) / 1000).toFixed(0)}s so far…`;
        return (
          <section className="card" key={e.id}>
            <div className="progress-head" onClick={() => setOpen(open === e.id ? null : e.id)} style={{ cursor: "pointer" }}>
              <span>
                <span className={`pill ${badgeClass}`}>{badge}</span> <strong>{elapsed}</strong> · {e.kind}
              </span>
              <span className="muted">{new Date(e.at).toLocaleTimeString()} · {open === e.id ? "hide" : "show"}</span>
            </div>
            {open === e.id && (
              <div>
                {e.system && (
                  <>
                    <strong>System prompt</strong>
                    <pre className="audit-pre">{e.system}</pre>
                  </>
                )}
                <strong>Sent to model</strong>
                <pre className="audit-pre">{e.user}</pre>
                <strong>{e.error ? "Error" : e.done ? "Model reply" : "Waiting for reply…"}</strong>
                {e.error ? (
                  <pre className="audit-pre error">{e.error}</pre>
                ) : e.done ? (
                  <pre className="audit-pre">{e.completion}</pre>
                ) : (
                  <p className="muted">still waiting for the model…</p>
                )}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
