"use client";

import { useState } from "react";
import { postJson } from "../ui";

type Json = any;

export default function LinkedInPage() {
  const [profileText, setProfileText] = useState("");
  const [jobText, setJobText] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<Json | null>(null);
  const [changeSet, setChangeSet] = useState<Json | null>(null);

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

  const doReview = () =>
    run("review", async () => {
      setChangeSet(null);
      const r = await postJson("/api/linkedin", { profileText, mode: "review" });
      setReview(r.review);
    });

  const doChangeSet = () =>
    run("changeset", async () => {
      setReview(null);
      const r = await postJson("/api/linkedin", { profileText, jobText, mode: "changeset" });
      setChangeSet(r.changeSet);
    });

  return (
    <main>
      <h1>LinkedIn</h1>
      <p className="muted">
        Review your profile (req. 1) and get copy-paste-ready changes with instructions (req. 2).
        Nothing is posted to LinkedIn — you paste the changes yourself.
      </p>

      <label><strong>LinkedIn profile text</strong></label>
      <textarea value={profileText} onChange={(e) => setProfileText(e.target.value)} placeholder="Paste your LinkedIn profile (or its PDF export text)…" />

      <details>
        <summary className="muted">Optional: target job to tailor the change set toward</summary>
        <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} placeholder="Paste a job description…" />
      </details>

      <div className="row">
        <button onClick={doReview} disabled={!!busy || !profileText.trim()}>
          {busy === "review" ? "Reviewing…" : "Review profile"}
        </button>
        <button className="secondary" onClick={doChangeSet} disabled={!!busy || !profileText.trim()}>
          {busy === "changeset" ? "Building…" : "Build change set"}
        </button>
      </div>

      {error && <p className="error">⚠ {error}</p>}

      {review && (
        <section className="card">
          <h2>Profile review — {review.overallScore}/100</h2>
          <p>{review.summary}</p>
          <div className="grid">
            <div><strong>Strengths</strong><ul>{review.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
            <div><strong>Weaknesses</strong><ul>{review.weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
          </div>
          <strong>Recommendations</strong>
          <ul>
            {review.recommendations.map((r: Json, i: number) => (
              <li key={i}><span className="pill">{r.priority}</span> <strong>{r.title}</strong> — {r.rationale}</li>
            ))}
          </ul>
        </section>
      )}

      {changeSet && (
        <section className="card">
          <h2>Change set</h2>
          <p>{changeSet.summary}</p>
          {changeSet.changes.map((c: Json, i: number) => (
            <div key={i} className="card">
              <strong>{c.field}</strong>
              {c.current && <p className="muted">current: {c.current}</p>}
              <p><strong>suggested:</strong> {c.suggested}</p>
              <p className="muted">how: {c.instructions}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
