# resume-preparation

A local-first application that reviews and improves your **resume**, **LinkedIn
profile**, and **cover letters** against real job descriptions — scoring each
skill and experience, explaining every "fit" vs. "stretch" judgment, and letting
you challenge scores, generate tailored documents, and revert any change.

Analysis runs against a **local, OpenAI-compatible LLM** (the same endpoint
pattern used by [`job-preparation`](../job-preparation)), so your personal data
stays on infrastructure you control.

> **Status:** Phase 0 — design & scaffolding. See [ROADMAP.md](ROADMAP.md) for
> the phased build plan and [docs/DESIGN.md](docs/DESIGN.md) for the architecture.

## What it does (target functionality)

- **Resume review** — strengths, weaknesses, an overall score, and prioritized
  recommendations, judged against fitting job categories, resume best practices,
  and ATS filtering strategies.
- **ATS optimization** — a separate ATS score with strengths/weaknesses and
  concrete fixes.
- **LinkedIn review** — the same, plus copy-paste-ready rewritten text and
  step-by-step update instructions (optional browser-assisted fill, off by
  default).
- **Job-description analysis** — from a URL or saved HTML: extract required vs.
  preferred skills and experiences, special application instructions, and a
  per-item fit score (strong / reasonable / weak / very weak / stretch).
- **Challenge a score** — push back on any skill/experience score; the app asks
  questions, weighs your evidence, and either recommends a resume/LinkedIn update
  or explains why the evidence is insufficient.
- **Improve a skill/experience** — actionable recommendations to raise a score.
- **Tailored generation** — updated resume (DOCX/PDF), custom cover letter, and a
  LinkedIn change set, each with an explanation page of what changed and why.
- **Version control** — every change is snapshotted; list, diff, and revert from
  the app.

## Quick start (developers)

```bash
npm ci
npm run typecheck
npm test
```

Requires Node 22+. Copy `.env.example` to `.env` and point `LLM_BASE_URL` at your
model server to enable LLM-backed features (not needed for the deterministic
unit tests).

## Layout

- `packages/*` — engine packages (analysis, scoring, parsing, versioning, LLM
  client). Pure/deterministic logic is unit-tested in CI.
- `web/` — Next.js app (added in a later phase) that wraps the engine.
- `docs/` — design documentation.
