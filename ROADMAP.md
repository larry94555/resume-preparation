# resume-preparation — Roadmap

The full application is delivered in phases. **Each phase is independently
testable and demoable**, adds unit tests that run at the git level (CI on every
PR), and does not require a later phase to be useful. Architecture is fixed in
[docs/DESIGN.md](docs/DESIGN.md).

Decisions locked in Phase 0:
- **Interface:** local **Next.js web app** over UI-agnostic engine packages.
- **LinkedIn:** import + analysis + copy-paste text & instructions; **optional**
  browser-assisted fill, off by default.
- **LLM:** reuse the **local OpenAI-compatible endpoint** (PII stays local).
- **Versioning:** **app-level snapshot store** (JSON + field-level diff + revert).
- **Constraints:** changes only in `resume-preparation`; **no commits** — the
  owner reviews and commits.

Legend for the requirement map: the numbers refer to the 12 functional
requirements in the original request.

---

## Phase 0 — Design & scaffolding ✅ (this deliverable)

- `docs/DESIGN.md`, this roadmap.
- Monorepo scaffold: root `package.json` (workspaces), `tsconfig.base.json`,
  `.env.example`, Node/TS `.gitignore`, `README.md`.
- **CI** (`.github/workflows/ci.yml`): typecheck + unit tests + coverage floors on
  every PR/push.
- **First tested package** `packages/scoring`: deterministic fit tiers &
  aggregation (`classifyScore`, `describeFit`, `summarizeFit`) + full unit tests —
  proves the git-level test harness is real and green.
- **Exit criteria:** `npm ci && npm run typecheck && npm test` all pass.

## Phase 1 — Foundations: schema, LLM client, resume ingestion

- `packages/schema`: shared TS types + zod validators for every model (§4).
- `packages/llm`: ported `LlamaClient` (JSON mode, seed, retry) + a
  schema-validating prompt runner; a live-endpoint smoke test that **self-skips**
  when no model is reachable.
- `packages/documents` (ingest half): PDF/DOCX → text → `ResumeModel` structuring.
- **Tests:** schema validation; document structuring on saved fixtures; prompt
  runner with a mocked client.
- **Exit:** given a sample PDF/DOCX resume, produce a validated `ResumeModel`.

## Phase 2 — Resume review & ATS  → covers req. 3, 12

- `packages/analysis`: resume review prompts → strengths, weaknesses, overall
  score, prioritized recommendations, judged against fitting job categories +
  best practices + anti-filtering strategies (**req. 3**).
- ATS review: separate ATS score, strengths/weaknesses, concrete changes, keyword
  coverage (**req. 12**).
- **Tests:** deterministic rubric/aggregation logic; prompt eval against golden
  fixtures (self-skips without a model).
- **Exit:** CLI/engine returns a full resume review + ATS review for a sample.

## Phase 3 — Job-description analysis & fit scoring  → covers req. 6, 7

- `packages/ingest`: fetch JD from **URL** or **saved HTML**; extract required vs.
  preferred **skills** and **experiences** and special application instructions
  (**req. 6**), with prompt-injection guarding.
- Matching engine: per-skill / per-experience 0–100 scores with cited evidence;
  overall fit via `packages/scoring` → strong / reasonable / weak / very weak /
  stretch; match explanations; **critical gaps** (**req. 7**).
- **Tests:** JD extraction on saved HTML fixtures; matching→tier aggregation
  (deterministic); evidence-grounding checks.
- **Exit:** paste a JD → get per-item scores + an explained overall verdict.

## Phase 4 — Interactive coaching: challenge & improve  → covers req. 8, 9

- Challenge-a-score flow: ask questions, weigh user evidence, then either
  recommend a resume/LinkedIn update (and re-score) or explain why the evidence is
  insufficient (**req. 8**).
- Work-on-a-skill/experience flow: actionable recommendations to raise a score
  (**req. 9**).
- Challenges and outcomes are recorded (feeds Phase 5 versioning).
- **Tests:** evidence-evaluation prompt evals; deterministic re-score deltas;
  conversation-state reducer unit tests.
- **Exit:** a user can dispute a score and get a reasoned, evidence-based response.

## Phase 5 — Versioning, generation & the web shell  → covers req. 4, 5, 10, 11

- `packages/versioning`: snapshot store — save, list, **field-level diff**,
  **revert** (append-only) (**req. 5**).
- `packages/documents` (generate half): `ResumeModel` → **DOCX** and **PDF**;
  custom **cover letter**; LinkedIn **change set**; each with an **explanation
  page** of what changed and why (**req. 4, 10**).
- Score the **updated** artifacts: keyword matches, covered skills/experiences,
  clarity of objective, best-practice checks (**req. 11**).
- **Web shell (Next.js):** upload/import, resume + ATS dashboards, JD fit
  dashboard, challenge chat, generation + explanation page, **version history &
  diff viewer** — so all prior phases are demoable in the browser.
- **Tests:** save/diff/revert; deterministic generation → parse round-trip;
  updated-artifact scoring logic.
- **Exit:** generate a tailored resume + cover letter, view/diff/revert versions
  in the browser, and see the updated-artifact score.

## Phase 6 — LinkedIn  → covers req. 1, 2

- Import a LinkedIn profile (PDF export / pasted text); review with the §6 rubric:
  strengths, weaknesses, score, recommendations (**req. 1**).
- Produce **copy-paste-ready** field text + step-by-step update instructions;
  **optional** browser-assisted fill behind `LINKEDIN_ASSISTED_FILL`, opt-in and
  confirmation-gated (**req. 2**).
- **Tests:** profile parsing on fixtures; change-set generation; assisted-fill
  logic behind a mocked browser driver (no live LinkedIn in CI).
- **Exit:** import a profile → scored review + copy-paste change set (+ optional
  assisted fill when explicitly enabled).

## Phase 7 — End-to-end tailoring workflow & polish

- One guided flow: resume + JD in → analysis → challenge/improve → generate
  tailored resume + cover letter + LinkedIn change set → score → versioned — all
  in the web app.
- UX polish, error handling, empty/skip states, docs/walkthrough.
- **Tests:** an end-to-end engine test wiring the full pipeline on fixtures with a
  mocked LLM; web smoke tests.
- **Exit:** a complete, demoable target-a-job workflow.

## Later / optional (not required for the target functionality)

- Model-picker UI + `model_configuration.yaml` catalog (as in `job-preparation`).
- `export --to-git` for versions; multi-user/auth; hosting.

---

## Cross-cutting practices (every phase)

- New deterministic logic ships with `node:test` unit tests; coverage floors in
  CI must stay green.
- LLM-backed evals **self-skip** in CI and run locally against the endpoint with
  fixed seeds + golden fixtures.
- Untrusted job HTML/URLs are treated as data, never instructions (§12).
- No commits by the assistant; the owner reviews and commits each phase.

## Requirement coverage map

| Req | Description | Phase |
|-----|-------------|-------|
| 1 | LinkedIn review (strengths/weaknesses/score/actions) | 6 |
| 2 | Update LinkedIn or give instructions (opt-in automation) | 6 |
| 3 | Resume review vs. job categories, best practices, anti-filtering | 2 |
| 4 | Create updated resume in DOCX/PDF | 5 |
| 5 | Version control for all changes (review/revert) | 5 |
| 6 | Job-description analysis (skills/experiences req vs. preferred, instructions) | 3 |
| 7 | Per-skill/experience scores + fit tiers + explanations | 3 (tiers: Phase 0) |
| 8 | Challenge a score; weigh evidence; recommend or explain | 4 |
| 9 | Work on a skill/experience; improvement recommendations | 4 |
| 10 | Generate tailored resume / LinkedIn changes / cover letter + explanation | 5 |
| 11 | Score updated artifacts (keywords, coverage, objective, best practices) | 5 |
| 12 | ATS optimization score, strengths/weaknesses, changes | 2 |
| 13 | Reuse the local LLM via clear structured prompts | 1 (throughout) |
| 14 | Only touch this repo; no commits | all |
