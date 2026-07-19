"use client";

import { useState } from "react";
import { postJson } from "../ui";

type Json = any;

export default function CoachPage() {
  const [resumeText, setResumeText] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("skill");
  const [importance, setImportance] = useState("required");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<Json | null>(null);
  const [improve, setImprove] = useState<Json | null>(null);

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

  const body = () => ({ resumeText, label, kind, importance });

  const doChallenge = () =>
    run("challenge", async () => {
      setImprove(null);
      setChallenge(await postJson("/api/challenge", { ...body(), evidence }));
    });

  const doImprove = () =>
    run("improve", async () => {
      setChallenge(null);
      setImprove(await postJson("/api/improve", body()));
    });

  const session = challenge?.session;

  return (
    <main>
      <h1>Coach</h1>
      <p className="muted">
        Challenge a score with evidence (req. 8) or get a plan to improve a skill/experience (req. 9).
      </p>

      <label><strong>Resume</strong></label>
      <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume text…" />

      <div className="row">
        <label>
          Requirement{" "}
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Kubernetes" />
        </label>
        <label>
          Kind{" "}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="skill">skill</option>
            <option value="experience">experience</option>
          </select>
        </label>
        <label>
          Importance{" "}
          <select value={importance} onChange={(e) => setImportance(e.target.value)}>
            <option value="required">required</option>
            <option value="preferred">preferred</option>
          </select>
        </label>
      </div>

      <label><strong>Your evidence</strong> <span className="muted">(for a challenge)</span></label>
      <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Describe concrete evidence you meet this requirement…" />

      <div className="row">
        <button onClick={doChallenge} disabled={!!busy || !resumeText.trim() || !label.trim()}>
          {busy === "challenge" ? "Evaluating…" : "Challenge score"}
        </button>
        <button className="secondary" onClick={doImprove} disabled={!!busy || !resumeText.trim() || !label.trim()}>
          {busy === "improve" ? "Planning…" : "Plan improvement"}
        </button>
      </div>

      {error && <p className="error">⚠ {error}</p>}

      {challenge && (
        <section className="card">
          <h2>{challenge.match.label}: {challenge.match.score}/100 <span className="pill">{challenge.match.tier}</span></h2>
          <p className="muted">{challenge.match.rationale}</p>
          <strong>Coach questions</strong>
          <ul>{challenge.questions.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul>
          {session && (session.status === "accepted" || session.status === "insufficient") && (
            <>
              <h3>Verdict: <span className="pill">{session.status}</span></h3>
              <p>{session.evaluation?.reasoning}</p>
              {session.status === "accepted" && session.rescore && (
                <p>
                  Re-scored: {session.originalScore} → {session.rescore.match.score}{" "}
                  ({session.rescore.delta >= 0 ? "+" : ""}{session.rescore.delta}), now{" "}
                  <span className="pill">{session.rescore.match.tier}</span>
                  {session.evaluation?.suggestedResumeBullet && (
                    <><br /><span className="muted">Suggested bullet: {session.evaluation.suggestedResumeBullet}</span></>
                  )}
                </p>
              )}
              {session.status === "insufficient" && session.evaluation?.missing?.length > 0 && (
                <p className="muted">Still missing: {session.evaluation.missing.join("; ")}</p>
              )}
            </>
          )}
        </section>
      )}

      {improve && (
        <section className="card">
          <h2>{improve.match.label}: {improve.match.score}/100 <span className="pill">{improve.match.tier}</span></h2>
          <p>{improve.plan.summary}</p>
          <ul>
            {improve.plan.actions.map((a: Json, i: number) => (
              <li key={i}>
                <span className="pill">{a.effort}{a.timeframe ? `, ${a.timeframe}` : ""}</span>{" "}
                <strong>{a.title}</strong> — {a.detail}
              </li>
            ))}
          </ul>
          {improve.plan.resources.length > 0 && <p className="muted">Resources: {improve.plan.resources.join(", ")}</p>}
        </section>
      )}
    </main>
  );
}
