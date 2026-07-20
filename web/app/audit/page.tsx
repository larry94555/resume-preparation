"use client";

import { useCallback, useEffect, useState } from "react";

interface AuditEntry {
  at: string;
  kind: "json" | "text";
  model: string;
  cached: boolean;
  durationMs: number;
  system: string;
  user: string;
  completion: string;
}

function fmtDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [auto, setAuto] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");

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
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [auto, refresh]);

  const clear = async () => {
    await fetch("/api/audit", { method: "DELETE" });
    refresh();
  };

  // Newest first for the list.
  const rows = [...entries].reverse();
  const liveCount = entries.filter((e) => !e.cached).length;

  return (
    <main>
      <h1>LLM Audit</h1>
      <p className="muted">
        Every request/response between the app and the model, in order — so you can
        see exactly what is happening and where the time goes. {entries.length} call(s),{" "}
        {liveCount} hit the model.
      </p>

      <div className="row">
        <button onClick={refresh}>Refresh</button>
        <label>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-refresh (2s)
        </label>
        <button className="secondary" onClick={clear}>Clear log</button>
      </div>

      {error && <p className="error">⚠ {error}</p>}
      {entries.length === 0 && <p className="muted">No calls yet. Run an analysis, then watch them appear here.</p>}

      {rows.map((e, i) => {
        const idx = entries.length - 1 - i; // stable index for expand toggle
        return (
          <section className="card" key={idx}>
            <div className="progress-head" onClick={() => setOpen(open === idx ? null : idx)} style={{ cursor: "pointer" }}>
              <span>
                <span className={`pill ${e.cached ? "ok" : ""}`}>{e.cached ? "cached" : "model"}</span>{" "}
                <strong>{fmtDuration(e.durationMs)}</strong> · {e.kind}
              </span>
              <span className="muted">{new Date(e.at).toLocaleTimeString()} · {open === idx ? "hide" : "show"}</span>
            </div>
            {open === idx && (
              <div>
                {e.system && (
                  <>
                    <strong>System prompt</strong>
                    <pre className="audit-pre">{e.system}</pre>
                  </>
                )}
                <strong>Sent to model</strong>
                <pre className="audit-pre">{e.user}</pre>
                <strong>Model reply</strong>
                <pre className="audit-pre">{e.completion}</pre>
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
