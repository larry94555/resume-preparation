# resume-preparation

A local-first application that reviews and improves your **resume**, **LinkedIn
profile**, and **cover letters** against real job descriptions — scoring each
skill and experience, explaining every "fit" vs. "stretch" judgment, and letting
you challenge scores, generate tailored documents, and revert any change.

Analysis runs against a **local, OpenAI-compatible LLM** (the same endpoint
pattern used by [`job-preparation`](../job-preparation)), so your personal data
stays on infrastructure you control.

> **Status:** feature-complete — all planned phases (0–7, incl. the Phase 5b
> **Next.js web shell**) are done. Resume review, ATS, job-description fit
> scoring, interactive coaching, versioning, DOCX/PDF + cover-letter generation,
> LinkedIn review + change set, and a one-call end-to-end tailoring workflow are
> all implemented, unit-tested, and usable in the browser (`npm run web:dev`) and
> via the CLIs below. See [ROADMAP.md](ROADMAP.md) for the phased plan and
> [docs/DESIGN.md](docs/DESIGN.md) for the architecture.

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

## Try it locally (end to end)

New here and want to run the whole thing against your own résumé, LinkedIn
profile, and a job posting? Follow **[Local_Walkthrough.md](Local_Walkthrough.md)**
— it covers installing a local model, evaluating your job-readiness, coaching,
generating a tailored résumé + cover letter, and a final pre-submission gap check
(in both the web app and the CLIs). Everything runs on your machine.

## Quick start (developers)

```bash
npm ci
npm run typecheck
npm test          # deterministic unit tests; live-model evals self-skip
```

Requires Node 22+. To enable LLM-backed features (not needed for the unit tests),
configure a model — **local or a llama server over the web** — in a gitignored
secrets file:

```bash
cp secrets/secrets.env.example secrets/secrets.env   # then edit it
npm run secrets:check                                # shows what's loaded (masked)
```

- **Local:** `LLM_BASE_URL=http://localhost:11434/v1` + `LLM_MODEL=…` (Ollama).
- **Hosted:** `LLAMA_SERVER_URL=https://…/v1` + `API_KEY=…` (aliases for
  `LLM_BASE_URL` / `LLM_API_KEY`).

The CLIs and web app load this file automatically. See
[Local_Walkthrough.md](Local_Walkthrough.md) for the full guide.

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

Four pages: **Tailor** (upload/paste a resume + job → review, ATS, job-fit
dashboard, one-click tailoring with DOCX downloads, and version history with
diff/revert), **Coach** (challenge a score with evidence, or plan an
improvement), **LinkedIn** (profile review + copy-paste change set), and
**Audit** (a live view of every request/response between the app and the model,
with timings — to see what's slow). Repeated runs are cached (deterministic
outputs) in a gitignored `working/` folder. Needs a running model
(`LLM_BASE_URL`) for analysis.

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
  - `workflow` — one-call end-to-end tailoring orchestration
- `web/` — Next.js web shell (Tailor / Coach / LinkedIn) that wraps the engine.
- `docs/` — design documentation.
