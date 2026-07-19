"use client";

import { useEffect, useState } from "react";

// The API payloads mirror the engine's outputs; typed loosely here since this
// shell just renders them. (The engine itself is fully typed and unit-tested.)
type Json = any;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function downloadBase64(name: string, base64: string, mime: string) {
  const a = document.createElement("a");
  a.href = `data:${mime};base64,${base64}`;
  a.download = name;
  a.click();
}

async function postJson(url: string, body: unknown): Promise<Json> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}

export default function Home() {
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [health, setHealth] = useState<boolean | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Json | null>(null);
  const [generation, setGeneration] = useState<Json | null>(null);
  const [versions, setVersions] = useState<Json[]>([]);
  const [diff, setDiff] = useState<Json[] | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(Boolean(d.ok)))
      .catch(() => setHealth(false));
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  const analyze = () =>
    run("analyze", async () => {
      setGeneration(null);
      setAnalysis(await postJson("/api/analyze", { resumeText, jobText }));
    });

  const generate = () =>
    run("generate", async () => {
      setGeneration(await postJson("/api/generate", { resumeText, jobText }));
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
  const score = generation?.score;

  return (
    <main>
      <h1>Resume Preparation</h1>
      <p className="muted">
        Local-first resume &amp; cover-letter coach.{" "}
        {health === null ? (
          <span className="pill">checking model…</span>
        ) : health ? (
          <span className="pill">model: online</span>
        ) : (
          <span className="pill error">model offline — set LLM_BASE_URL</span>
        )}
      </p>

      <div className="grid">
        <div>
          <label>
            <strong>Resume text</strong>
          </label>
          <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume as plain text…" />
        </div>
        <div>
          <label>
            <strong>Job description</strong> <span className="muted">(optional for review; required to generate)</span>
          </label>
          <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} placeholder="Paste the job description…" />
        </div>
      </div>

      <div className="row">
        <button onClick={analyze} disabled={!!busy || !resumeText.trim()}>
          {busy === "analyze" ? "Analyzing…" : "Analyze resume"}
        </button>
        <button onClick={generate} disabled={!!busy || !resumeText.trim() || !jobText.trim()}>
          {busy === "generate" ? "Generating…" : "Generate tailored docs"}
        </button>
        <button className="secondary" onClick={() => run("versions", loadVersions)} disabled={!!busy}>
          Load version history
        </button>
      </div>

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
          <h2>
            Job fit — {fit.overallScore}/100 <span className="pill">{fit.verdict}</span>
          </h2>
          {fit.criticalGaps.length > 0 && (
            <p className="error">Critical gaps: {fit.criticalGaps.map((g: Json) => g.label).join(", ")}</p>
          )}
          <table>
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Kind</th>
                <th>Importance</th>
                <th>Score</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              {fit.matches.map((m: Json, i: number) => (
                <tr key={i}>
                  <td>{m.label}</td>
                  <td>{m.kind}</td>
                  <td>{m.importance}</td>
                  <td>{m.score}</td>
                  <td>{m.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {generation && (
        <section className="card">
          <h2>Tailored documents</h2>
          {score && (
            <p>
              Fit {score.fit.overallScore}/100 · ATS {score.ats.atsScore}/100 · clear objective:{" "}
              {score.hasClearObjective ? "yes" : "no"}
              <br />
              <span className="muted">
                Covered: {score.coveredRequirements.join(", ") || "—"} · Missing:{" "}
                {score.missingRequirements.join(", ") || "—"}
              </span>
            </p>
          )}
          <div className="row">
            <button onClick={() => downloadBase64("tailored-resume.docx", generation.resumeDocxBase64, DOCX_MIME)}>
              Download resume .docx
            </button>
            <button onClick={() => downloadBase64("cover-letter.docx", generation.coverDocxBase64, DOCX_MIME)}>
              Download cover letter .docx
            </button>
          </div>
          <p className="muted">
            Saved versions — resume: <code>{generation.versions.resume}</code>, cover:{" "}
            <code>{generation.versions.cover}</code>
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
            <thead>
              <tr>
                <th>ID</th>
                <th>Created</th>
                <th>Source</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v: Json) => (
                <tr key={v.id}>
                  <td><code>{v.id}</code></td>
                  <td className="muted">{v.createdAt}</td>
                  <td>{v.source}</td>
                  <td className="muted">{v.note ?? ""}</td>
                  <td>
                    <button className="secondary" onClick={() => revert(v.id)} disabled={!!busy}>
                      Revert
                    </button>
                  </td>
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
                      <code>
                        {d.type === "added" ? "+" : d.type === "removed" ? "−" : "~"} {d.path}
                      </code>
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
