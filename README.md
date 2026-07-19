# resume-preparation

A local-first application that reviews and improves your **resume**, **LinkedIn
profile**, and **cover letters** against real job descriptions — scoring each
skill and experience, explaining every "fit" vs. "stretch" judgment, and letting
you challenge scores, generate tailored documents, and revert any change.

Analysis runs against a **local, OpenAI-compatible LLM** (the same endpoint
pattern used by [`job-preparation`](../job-preparation)), so your personal data
stays on infrastructure you control.

> **Status:** all 12 functional requirements are implemented (Phases 0–6, plus
> the Phase 5b **Next.js web shell**): resume review, ATS, job-description fit
> scoring, interactive coaching, versioning, DOCX/PDF + cover-letter generation,
> and LinkedIn review + change set. Remaining work is Phase 7 polish (file
> upload, challenge chat, LinkedIn page in the UI). See [ROADMAP.md](ROADMAP.md)
> for the phased plan and [docs/DESIGN.md](docs/DESIGN.md) for the architecture.
> The engine is usable through the demo CLIs below and the web app
> (`npm run web:dev`).

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
npm test          # deterministic unit tests; live-model evals self-skip
```

Requires Node 22+. Copy `.env.example` to `.env` and point `LLM_BASE_URL` at your
model server to enable LLM-backed features (not needed for the deterministic
unit tests).

## Demo CLIs (need a running model — set `LLM_BASE_URL`)

Prefix with `node --env-file=.env` to load your `.env`.

```bash
npm run review   -- <resume.pdf>                                  # resume + ATS review (req. 3, 12)
npm run match    -- <resume.pdf> --job-url <url>                  # per-requirement fit scoring (req. 6, 7)
npm run coach    -- challenge <resume.pdf> --requirement "Kubernetes" --evidence "…"   # req. 8
npm run coach    -- improve   <resume.pdf> --requirement "Kubernetes"                  # req. 9
npm run generate -- <resume.pdf> --job-html <job.html>           # tailored resume+cover letter+explanation, scored & versioned (req. 4, 5, 10, 11)
npm run linkedin -- review    <profile.pdf>                      # LinkedIn profile review (req. 1)
npm run linkedin -- changeset <profile.pdf> --job-text <job.txt> # copy-paste LinkedIn changes + instructions (req. 2)
```

## Web app (Phase 5b)

```bash
npm run web:dev     # Next.js dev server at http://localhost:3000
npm run web:build   # production build (also run in CI to type-check the app)
```

Paste your resume (and optionally a job description) to get a review, ATS score,
and job-fit dashboard; generate tailored DOCX downloads; and browse version
history with diff/revert. Needs a running model (`LLM_BASE_URL`) for analysis.

## Layout

- `packages/*` — engine packages, all unit-tested in CI:
  - `schema` — shared types + zod validation
  - `scoring` — deterministic fit tiers & aggregation
  - `llm` — OpenAI-compatible client + schema-validating prompt runner
  - `documents` — resume ingestion (PDF/DOCX/HTML) + DOCX/PDF generation
  - `ingest` — job-description fetch/extract (injection-guarded)
  - `analysis` — resume/ATS review, JD matching, coaching, tailored scoring
  - `versioning` — snapshot store with field-level diff + revert
  - `linkedin` — profile import, review, change set, opt-in assisted fill
- `web/` — Next.js web shell (Phase 5b) that wraps the engine.
- `docs/` — design documentation.
