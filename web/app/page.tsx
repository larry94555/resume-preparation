"use client";

import { useEffect, useRef, useState } from "react";
import { DOCX_MIME, downloadBase64, postJson, streamJson, uploadFileText, type Progress } from "./ui";

// API payloads mirror the engine's (fully-typed, unit-tested) outputs; typed
// loosely here since this shell only renders them.
type Json = any;

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobMode, setJobMode] = useState<"url" | "html" | "text">("url");
  const [jobUrl, setJobUrl] = useState("");
  const [jobHtml, setJobHtml] = useState("");
  const [jobHtmlName, setJobHtmlName] = useState("");
  const [jobText, setJobText] = useState("");
  const [linkedinText, setLinkedinText] = useState("");
  const [health, setHealth] = useState<boolean | null>(null);
  const [healthDetail, setHealthDetail] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const [analysis, setAnalysis] = useState<Json | null>(null);
  const [generation, setGeneration] = useState<Json | null>(null);
  const [versions, setVersions] = useState<Json[]>([]);
  const [diff, setDiff] = useState<Json[] | null>(null);

  // On load, confirm the model can actually generate (a real "hello" test) — not
  // just that the endpoint is reachable.
  useEffect(() => {
    fetch("/api/warmup")
      .then((r) => r.json())
      .then((d) => {
        setHealth(Boolean(d.ok));
        setHealthDetail(String(d.detail ?? ""));
      })
      .catch((e) => {
        setHealth(false);
        setHealthDetail(e instanceof Error ? e.message : String(e));
      });
  }, []);

  // Tick the elapsed-time counter while a progress-tracked action runs.
  useEffect(() => {
    if (!progress) return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [progress !== null]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
      setProgress(null);
    }
  }

  function startProgress() {
    startRef.current = Date.now();
    setElapsed(0);
    setLog([]);
    setProgress({ phase: "Starting…", done: 0, total: 0 });
  }

  // Update the bar and append any detail line to the activity log.
  const onProgress = (p: Progress) => {
    setProgress(p);
    if (p.detail) setLog((prev) => [...prev, p.detail!]);
  };

  // Keep the activity log scrolled to the newest line.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    run("upload", async () => setResumeText(await uploadFileText(file)));
  };

  const onJobHtml = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setJobHtml(String(reader.result ?? ""));
      setJobHtmlName(file.name);
    };
    reader.readAsText(file);
  };

  // Whichever job source is active becomes the request field the API expects.
  const jobFields = () =>
    jobMode === "url" ? { jobUrl } : jobMode === "html" ? { jobHtml } : { jobText };
  const hasJob =
    (jobMode === "url" && jobUrl.trim()) ||
    (jobMode === "html" && jobHtml.trim()) ||
    (jobMode === "text" && jobText.trim());

  const analyze = () =>
    run("analyze", async () => {
      setGeneration(null);
      setAnalysis(null);
      startProgress();
      setAnalysis(await streamJson("/api/analyze", { resumeText, ...jobFields() }, onProgress));
    });

  const tailor = () =>
    run("tailor", async () => {
      startProgress();
      const r = await streamJson("/api/workflow", { resumeText, ...jobFields(), linkedinText }, onProgress);
      setAnalysis({ reviews: { review: r.review, reviewTier: r.reviewTier, ats: r.ats, atsTier: r.atsTier }, fit: r.fit });
      setGeneration(r);
      await loadVersions();
    });

  async function loadVersions() {
    const d = await (await fetch("/api/versions?target=resume")).json();
    setVersions(d.history ?? []);
    setDiff(null);
  }

  const diffLatest = () =>
    run("diff", async () => {
      if (versions.length < 2) throw new Error("Need at least two versions to diff.");
      const from = versions[versions.length - 2].id;
      const to = versions[versions.length - 1].id;
      const d = await (await fetch(`/api/versions?from=${from}&to=${to}`)).json();
      setDiff(d.diff ?? []);
    });

  const revert = (id: string) =>
    run("revert", async () => {
      await postJson("/api/versions", { action: "revert", id });
      await loadVersions();
    });

  const rv = analysis?.reviews;
  const fit = analysis?.fit;

  return (
    <main>
      <h1>Tailor your resume</h1>
      <p className="muted">
        Local-first resume &amp; cover-letter coach.{" "}
        {health === null ? (
          <span className="pill">testing the model… (first load can take a moment)</span>
        ) : health ? (
          <span className="pill ok" title={healthDetail}>✓ LLM is accessible and working…</span>
        ) : (
          <span className="pill error" title={healthDetail}>✗ LLM problem</span>
        )}
        {health === false && healthDetail && (
          <>
            <br />
            <span className="error" style={{ fontSize: 13 }}>⚠ {healthDetail}</span>
          </>
        )}
      </p>

      <div className="grid">
        <div>
          <label>
            <strong>Resume</strong>{" "}
            <span className="muted">
              paste text, or upload{" "}
              <input
                type="file"
                accept=".pdf,.docx,.txt,.html"
                onChange={(e) => onUpload(e.target.files?.[0])}
                disabled={!!busy}
              />
            </span>
          </label>
          <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume, or upload a PDF/DOCX above…" />
        </div>
        <div>
          <label>
            <strong>Job description</strong> <span className="muted">(optional for review; required to tailor)</span>
          </label>
          <div className="row" role="radiogroup" aria-label="Job description source">
            <label><input type="radio" name="jobmode" checked={jobMode === "url"} onChange={() => setJobMode("url")} /> URL</label>
            <label><input type="radio" name="jobmode" checked={jobMode === "html"} onChange={() => setJobMode("html")} /> Saved HTML</label>
            <label><input type="radio" name="jobmode" checked={jobMode === "text"} onChange={() => setJobMode("text")} /> Paste text</label>
          </div>
          {jobMode === "url" && (
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://example.com/careers/backend-engineer"
              style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 6 }}
            />
          )}
          {jobMode === "html" && (
            <div>
              <input type="file" accept=".html,.htm" onChange={(e) => onJobHtml(e.target.files?.[0])} disabled={!!busy} />
              {jobHtmlName && <p className="muted">Loaded {jobHtmlName} ({jobHtml.length.toLocaleString()} chars).</p>}
            </div>
          )}
          {jobMode === "text" && (
            <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} placeholder="Paste the job description…" />
          )}
        </div>
      </div>

      <details>
        <summary className="muted">Optional: paste your LinkedIn profile to also get a change set</summary>
        <textarea value={linkedinText} onChange={(e) => setLinkedinText(e.target.value)} placeholder="Paste your LinkedIn profile text…" />
      </details>

      <div className="row">
        <button onClick={analyze} disabled={!!busy || !resumeText.trim()}>
          {busy === "analyze" ? "Analyzing…" : "Analyze resume"}
        </button>
        <button onClick={tailor} disabled={!!busy || !resumeText.trim() || !hasJob}>
          {busy === "tailor" ? "Tailoring…" : "Run full tailoring"}
        </button>
        <button className="secondary" onClick={() => run("versions", loadVersions)} disabled={!!busy}>
          Load version history
        </button>
      </div>

      {progress && (
        <section className="card">
          <div className="progress-head">
            <span>{progress.phase}</span>
            <span className="muted">
              {progress.total > 0 ? `${progress.done}/${progress.total} · ` : ""}
              {elapsed}s elapsed
              {progress.total > 0 && progress.done > 0
                ? ` · ~${Math.max(0, Math.round((elapsed / progress.done) * (progress.total - progress.done)))}s left`
                : ""}
            </span>
          </div>
          <div className="progress-track">
            <div
              className={progress.total > 0 ? "progress-fill" : "progress-fill indeterminate"}
              style={progress.total > 0 ? { width: `${Math.round((progress.done / progress.total) * 100)}%` } : undefined}
            />
          </div>
        </section>
      )}

      {log.length > 0 && (
        <section className="card">
          <strong>Activity {progress && <span className="muted">(working…)</span>}</strong>
          <div className="log" ref={logRef}>
            {log.map((line, i) => (
              <div key={i} className="log-line">
                {line}
              </div>
            ))}
          </div>
        </section>
      )}

      {error && <p className="error">⚠ {error}</p>}

      {rv && (
        <section className="card">
          <h2>Resume review — {rv.review.overallScore}/100 <span className="pill">{rv.reviewTier}</span></h2>
          <p>{rv.review.summary}</p>
          <div className="grid">
            <div>
              <strong>Strengths</strong>
              <ul>{rv.review.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div>
              <strong>Weaknesses</strong>
              <ul>{rv.review.weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </div>
          </div>
          <strong>Recommendations</strong>
          <ul>
            {rv.review.recommendations.map((r: Json, i: number) => (
              <li key={i}>
                <span className="pill">{r.priority}</span> <strong>{r.title}</strong> — {r.rationale}
              </li>
            ))}
          </ul>
          <h3>ATS — {rv.ats.atsScore}/100 <span className="pill">{rv.atsTier}</span></h3>
          <p>{rv.ats.summary}</p>
          <p className="muted">
            Keywords present: {rv.ats.keywords.present.join(", ") || "—"}
            <br />
            Keywords recommended: {rv.ats.keywords.recommended.join(", ") || "—"}
          </p>
        </section>
      )}

      {fit && (
        <section className="card">
          <h2>Job fit — {fit.overallScore}/100 <span className="pill">{fit.verdict}</span></h2>
          {fit.criticalGaps.length > 0 && (
            <p className="error">Critical gaps: {fit.criticalGaps.map((g: Json) => g.label).join(", ")}</p>
          )}
          <table>
            <thead>
              <tr><th>Requirement</th><th>Kind</th><th>Importance</th><th>Score</th><th>Tier</th></tr>
            </thead>
            <tbody>
              {fit.matches.map((m: Json, i: number) => (
                <tr key={i}>
                  <td>{m.label}</td><td>{m.kind}</td><td>{m.importance}</td><td>{m.score}</td><td>{m.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {generation && (
        <section className="card">
          <h2>Tailored documents</h2>
          <p className="muted">
            Covered: {generation.coverage.covered.join(", ") || "—"} · Missing:{" "}
            {generation.coverage.missing.join(", ") || "—"}
          </p>
          <div className="row">
            <button onClick={() => downloadBase64("tailored-resume.docx", generation.documents.resumeDocxBase64, DOCX_MIME)}>
              Download resume .docx
            </button>
            <button onClick={() => downloadBase64("cover-letter.docx", generation.documents.coverLetterDocxBase64, DOCX_MIME)}>
              Download cover letter .docx
            </button>
          </div>
          {generation.linkedin && (
            <p className="muted">
              LinkedIn review: {generation.linkedin.review.overallScore}/100 · {generation.linkedin.changeSet.changes.length} suggested changes (see LinkedIn tab).
            </p>
          )}
          <p className="muted">
            Saved versions — resume: <code>{generation.versions.resume}</code>, cover:{" "}
            <code>{generation.versions.coverLetter}</code>
            {generation.versions.linkedInChangeSet ? <> , LinkedIn: <code>{generation.versions.linkedInChangeSet}</code></> : null}
          </p>
        </section>
      )}

      {versions.length > 0 && (
        <section className="card">
          <h2>Version history (resume)</h2>
          <div className="row">
            <button className="secondary" onClick={diffLatest} disabled={!!busy || versions.length < 2}>
              Diff last two
            </button>
          </div>
          <table>
            <thead><tr><th>ID</th><th>Created</th><th>Source</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {versions.map((v: Json) => (
                <tr key={v.id}>
                  <td><code>{v.id}</code></td>
                  <td className="muted">{v.createdAt}</td>
                  <td>{v.source}</td>
                  <td className="muted">{v.note ?? ""}</td>
                  <td><button className="secondary" onClick={() => revert(v.id)} disabled={!!busy}>Revert</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {diff && (
            <>
              <h3>Diff (last two versions)</h3>
              {diff.length === 0 ? (
                <p className="muted">No differences.</p>
              ) : (
                <ul>
                  {diff.map((d: Json, i: number) => (
                    <li key={i}>
                      <code>{d.type === "added" ? "+" : d.type === "removed" ? "−" : "~"} {d.path}</code>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
