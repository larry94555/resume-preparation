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

## Progress at a glance

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Design & scaffolding | ✅ Complete |
| 1 | Foundations: schema, LLM client, resume ingestion | ✅ Complete |
| 2 | Resume review & ATS (req. 3, 12) | ✅ Complete |
| 3 | Job-description analysis & fit scoring (req. 6, 7) | ✅ Complete |
| 4 | Interactive coaching: challenge & improve (req. 8, 9) | ✅ Complete |
| 5 | Versioning, generation & tailored scoring (req. 4, 5, 10, 11) — **engine** | ✅ Complete |
| 5b | Web shell (Next.js) | ⬜ Planned (split out of Phase 5) |
| 6 | LinkedIn review + change set (req. 1, 2) | ⬜ Planned |
| 7 | End-to-end tailoring workflow & polish | ⬜ Planned |

The engine (`packages/*`) covers all 12 functional requirements except LinkedIn
(Phase 6). It is exercised today through the demo CLIs (`npm run review`, `match`,
`coach`, `generate`); the browser UI is Phase 5b. Current engine packages:
`schema`, `scoring`, `llm`, `documents`, `ingest`, `analysis`, `versioning`.

---

## Phase 0 — Design & scaffolding ✅

- `docs/DESIGN.md`, this roadmap, `README.md`.
- Monorepo scaffold: root `package.json` (workspaces), `tsconfig.base.json`,
  `.env.example`, Node/TS `.gitignore`.
- **CI** (`.github/workflows/ci.yml`): typecheck + unit tests + coverage floors on
  every PR/push.
- **First tested package** `packages/scoring`: deterministic fit tiers &
  aggregation (`classifyScore`, `describeFit`, `summarizeFit`).
- **Exit met:** `npm ci && npm run typecheck && npm test` all pass.

## Phase 1 — Foundations: schema, LLM client, resume ingestion ✅

- `packages/schema`: shared TS types + zod validators (`ResumeModel`,
  `SourceDocument`, `validate`/`parseOrThrow`).
- `packages/llm`: ported `LlamaClient` (JSON mode, seed, retry) + the
  schema-validating `runStructured` prompt runner + `extractJsonObject`; a
  live-endpoint smoke test that **self-skips** when no model is reachable.
- `packages/documents` (ingest half): PDF/DOCX/text/HTML → text → `ResumeModel`
  structuring (`extractText`, `structureResume`, `ingestResume`), with committed
  DOCX/PDF fixtures.
- **Exit met:** given a sample PDF/DOCX resume, produce a validated `ResumeModel`.

## Phase 2 — Resume review & ATS ✅ → covers req. 3, 12

- `packages/analysis`: `reviewResume` → strengths, weaknesses, overall score,
  prioritized recommendations vs. fitting job categories + best practices +
  anti-filtering strategies (**req. 3**). Deterministic `renderResumeText` +
  `computeAtsSignals` feed the prompts.
- `reviewAts` → separate ATS score, strengths/weaknesses, changes, keyword
  coverage (accepts an optional target job description) (**req. 12**);
  `reviewAll` runs both and classifies each score into a tier.
- Schema: `ResumeReview`, `AtsReview`, `Recommendation`, `Priority`.
- **Demo:** `npm run review -- <file>`.
- **Exit met:** engine returns a full resume review + ATS review for a sample.

## Phase 3 — Job-description analysis & fit scoring ✅ → covers req. 6, 7

- `packages/ingest`: `ingestJobDescription` fetches a JD from **URL** or **saved
  HTML** (or plain text); extracts required vs. preferred **skills** and
  **experiences** and application instructions (**req. 6**), with
  prompt-injection guarding (untrusted text bounded + data-only prompt framing).
- Matching engine (`packages/analysis`): per-requirement 0–100 scores with cited
  evidence (`scoreRequirement`) → overall fit via `packages/scoring` (strong /
  reasonable / weak / very weak / stretch) with **critical gaps** (`matchResumeToJob`,
  `buildFitReport`) (**req. 7**).
- Schema: `JobDescription`, `JobExtraction`, `MatchAssessment`.
- **Demo:** `npm run match`.
- **Exit met:** paste a JD → per-item scores + an explained overall verdict.

## Phase 4 — Interactive coaching: challenge & improve ✅ → covers req. 8, 9

- Challenge-a-score flow (`packages/analysis`): a pure `challengeReducer` state
  machine + LLM steps (`askChallengeQuestions`, `evaluateEvidence`) and
  `submitChallengeEvidence`, which on credible evidence re-scores with a
  **deterministic delta** and on insufficient evidence explains what's missing
  (**req. 8**).
- Improve-a-skill flow: `planImprovement` → effort-rated, actionable steps
  (**req. 9**).
- Schema: `ChallengeQuestions`, `EvidenceEvaluation`, `ImprovementPlan`.
- Challenge sessions are plain serializable data (feed Phase 5 versioning).
- **Demo:** `npm run coach -- challenge|improve …`.
- **Exit met:** a user can dispute a score and get a reasoned, evidence-based
  response.

## Phase 5 — Versioning, generation & tailored scoring ✅ (engine) → covers req. 4, 5, 10, 11

Delivered as the **engine**; the Next.js web shell was split into Phase 5b.

- `packages/versioning`: append-only snapshot store — `save`, `history`, `head`,
  `get`, **field-level `diff`**, **`revert`** (revert appends a new snapshot; the
  history is never rewritten) (**req. 5**).
- `packages/documents` (generate half): `ResumeModel` → **DOCX** and **PDF** via a
  shared deterministic `Block[]` model; custom **cover letter** (`composeCoverLetter`
  + render); **explanation page** of what changed and why (**req. 4, 10**).
- `packages/analysis`: `scoreTailoredResume` scores an updated resume against a
  job — covered vs. missing requirements, keyword matches/gaps, clear-objective
  check, ATS best practices (**req. 11**).
- Schema: `CoverLetter`.
- **Demo:** `npm run generate` — tailored resume (DOCX + PDF) + cover letter +
  explanation page, scored and versioned end to end.
- **Exit met (engine):** generate a tailored resume + cover letter, diff/revert
  versions, and see the updated-artifact score. The **browser** portion of the
  original exit criterion moves to Phase 5b.
- **Deferred to Phase 6:** the LinkedIn change set (kept with the rest of the
  LinkedIn work).

## Phase 5b — Web shell (Next.js) ⬜ → makes prior phases browser-usable

- `web/`: Next.js app wrapping the engine — upload/import, resume + ATS
  dashboards, JD fit dashboard, challenge chat, generation + explanation page,
  **version history & diff viewer**.
- **Tests:** web smoke tests; engine remains covered by its own unit tests.
- **Exit:** the Phase 1–5 features are usable in the browser.

## Phase 6 — LinkedIn ⬜ → covers req. 1, 2

- Import a LinkedIn profile (PDF export / pasted text); review with the resume
  rubric: strengths, weaknesses, score, recommendations (**req. 1**).
- Produce **copy-paste-ready** field text + step-by-step update instructions, and
  a versioned **change set**; **optional** browser-assisted fill behind
  `LINKEDIN_ASSISTED_FILL`, opt-in and confirmation-gated (**req. 2**).
- **Tests:** profile parsing on fixtures; change-set generation; assisted-fill
  logic behind a mocked browser driver (no live LinkedIn in CI).
- **Exit:** import a profile → scored review + copy-paste change set (+ optional
  assisted fill when explicitly enabled).

## Phase 7 — End-to-end tailoring workflow & polish ⬜

- One guided flow: resume + JD in → analysis → challenge/improve → generate
  tailored resume + cover letter + LinkedIn change set → score → versioned — all
  in the web app.
- UX polish, error handling, empty/skip states, docs/walkthrough.
- **Exit:** a complete, demoable target-a-job workflow.

## Later / optional (not required for the target functionality)

- Model-picker UI + `model_configuration.yaml` catalog (as in `job-preparation`).
- `export --to-git` for versions; multi-user/auth; hosting.

---

## Cross-cutting practices (every phase)

- New deterministic logic ships with `node:test` unit tests; coverage floors in
  CI must stay green.
- LLM-backed behavior is exercised with fake clients in unit tests; live evals
  **self-skip** in CI and run locally against the endpoint with fixed seeds.
- Untrusted job HTML/URLs are treated as data, never instructions (§12).
- No commits by the assistant; the owner reviews and commits each phase.

## Requirement coverage map

| Req | Description | Phase | Status |
|-----|-------------|-------|--------|
| 1 | LinkedIn review (strengths/weaknesses/score/actions) | 6 | ⬜ |
| 2 | Update LinkedIn or give instructions (opt-in automation) | 6 | ⬜ |
| 3 | Resume review vs. job categories, best practices, anti-filtering | 2 | ✅ |
| 4 | Create updated resume in DOCX/PDF | 5 | ✅ |
| 5 | Version control for all changes (review/revert) | 5 | ✅ |
| 6 | Job-description analysis (skills/experiences req vs. preferred, instructions) | 3 | ✅ |
| 7 | Per-skill/experience scores + fit tiers + explanations | 3 (tiers: Phase 0) | ✅ |
| 8 | Challenge a score; weigh evidence; recommend or explain | 4 | ✅ |
| 9 | Work on a skill/experience; improvement recommendations | 4 | ✅ |
| 10 | Generate tailored resume / cover letter + explanation (LinkedIn changes: Phase 6) | 5 | ✅ (cover letter/resume); LinkedIn ⬜ |
| 11 | Score updated artifacts (keywords, coverage, objective, best practices) | 5 | ✅ |
| 12 | ATS optimization score, strengths/weaknesses, changes | 2 | ✅ |
| 13 | Reuse the local LLM via clear structured prompts | 1 (throughout) | ✅ |
| 14 | Only touch this repo; no commits | all | ✅ |

_Browser access to these features is delivered in Phase 5b (web shell)._
