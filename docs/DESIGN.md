# resume-preparation — Design (Phase 0)

This document is the architectural baseline the phased build in
[ROADMAP.md](../ROADMAP.md) implements. It is intentionally written before any
functional code so each later phase can be reviewed against a fixed target.

---

## 1. Goals & non-goals

### Goals
- Review a **resume**, **LinkedIn profile**, and **cover letter**, each with
  strengths, weaknesses, an overall score, and prioritized recommendations.
- Analyze a **job description** (from URL or saved HTML) and score how well the
  resume/LinkedIn evidences each required and preferred **skill** and
  **experience**, classifying overall fit as strong / reasonable / weak / very
  weak / stretch.
- Make every score **auditable**: the user can drill into per-item evidence and
  **challenge** any score through an evidence-weighing dialogue.
- **Generate** tailored artifacts — updated resume (DOCX/PDF), custom cover
  letter, LinkedIn change set — each paired with an **explanation page**.
- Score the **updated** artifacts (keyword coverage, ATS, best practices).
- Keep a full **version history** with review, diff, and revert.
- Run all analysis on a **local, self-hosted LLM** (PII stays local).

### Non-goals (initially)
- No multi-user SaaS, accounts, or hosting. This is a **single-user, local-first**
  tool. (Auth can be layered later, mirroring `job-preparation`.)
- No unsupported LinkedIn write API. Direct profile editing is out; see §9.
- No guarantee of passing any specific vendor's ATS — we optimize against
  well-documented ATS best practices, not a black-box scorer.

---

## 2. Reuse from `job-preparation`

We deliberately mirror the sibling project so the two share mental model and
tooling. Reused patterns (re-implemented in this repo; **no edits to
`job-preparation`**):

- **LLM client** — a small `LlamaClient` over an OpenAI-compatible endpoint,
  env-configured (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_SEED`,
  `LLM_MAX_TOKENS`, `LLM_TIMEOUT_MS`), pinned to `temperature 0` + fixed seed +
  greedy decoding for **reproducible** output, with JSON mode and retry/backoff.
- **Determinism discipline** — the model host must run single-slot
  (`--parallel 1`) for reproducible grading; documented in setup.
- **Toolchain** — npm workspaces monorepo, TypeScript (strict), Node 22,
  `node:test` via `tsx`, GitHub Actions CI enforcing typecheck + tests +
  coverage floors.
- **Model catalog** — an optional `model_configuration.yaml`-style catalog can be
  added later if we want a model-picker UI; Phase 1 just reads env.

---

## 3. Architecture

Monorepo of small, single-purpose packages under `packages/*`, to be consumed by
a Next.js app under `web/` (Phase 5b). The engine is UI-agnostic and fully
testable without a browser or a live model. Status below reflects what is built
(✅) vs. planned (⬜); see [ROADMAP.md](../ROADMAP.md).

```
resume-preparation/
├─ packages/
│  ├─ scoring/        # ✅ deterministic fit tiers & aggregation
│  ├─ schema/         # ✅ shared TS types + runtime validation (zod) for all models
│  ├─ llm/            # ✅ LlamaClient + runStructured prompt runner (JSON-mode, retries, seed)
│  ├─ documents/      # ✅ parse (PDF/DOCX/HTML→ResumeModel) & generate (DOCX/PDF, cover letter, explanation)
│  ├─ ingest/         # ✅ job-description fetch (URL/HTML) + skill/experience extract (injection-guarded)
│  ├─ analysis/       # ✅ resume/ATS review, JD-match, coaching (challenge/improve), tailored scoring
│  ├─ versioning/     # ✅ app-level snapshot store: save, history, field-level diff, revert
│  ├─ linkedin/       # ✅ import parse + review + change-set + (optional, gated) assisted fill
│  └─ workflow/       # ✅ Phase 7: one-call end-to-end tailoring orchestration
├─ web/               # ✅ Phase 5b/7: Next.js UI (Tailor / Coach / LinkedIn)
├─ docs/
├─ .github/workflows/ci.yml
└─ package.json (workspaces)
```

Demo CLIs live in `packages/analysis/bin/` (`review`, `match`, `coach`,
`generate`) and are wired as root npm scripts; they drive the engine end to end
until the web shell lands.

**Dependency direction:** `schema` ← everything; `scoring` ← `analysis`;
`llm` ← `documents`/`ingest`/`analysis`; `documents`/`ingest`/`versioning` ←
`analysis` (the last only via its demo CLIs); `linkedin` (Phase 6) will depend on
`llm`/`schema`. No cycles.

**Layering rule that makes the app testable:** the LLM returns *raw structured
data* (scores, extracted items, rationales). All *classification, aggregation,
thresholds, diffing, and versioning* live in deterministic code
(`scoring`, `versioning`, `documents`). This is why `packages/scoring` can be
fully unit-tested in Phase 0 with no model.

---

## 4. Data model (high level; formalized in `packages/schema`)

- **Document** — a resume / cover letter / linkedin-profile snapshot. Holds the
  original file (path + format: `pdf` | `docx` | `text` | `html`), extracted
  plain text, and a parsed **structured** form.
- **ResumeModel** — contact block, summary, `experiences[]` (title, org, dates,
  bullets), `education[]`, `skills[]`, `certifications[]`, `projects[]`. This is
  the canonical form we score and regenerate from.
- **JobDescription** — source (`url` | `html`), company/title, `requiredSkills[]`,
  `preferredSkills[]`, `requiredExperiences[]`, `preferredExperiences[]`,
  `applicationInstructions[]`, raw text.
- **Requirement / ScoredItem** — one skill or experience with `importance`
  (`required`|`preferred`) and, after matching, a 0–100 `score`, the `evidence`
  the model cited (which resume bullet / LinkedIn line), and a short rationale.
- **Review** — target (resume|linkedin|cover|updated-artifact), `overallScore`,
  `strengths[]`, `weaknesses[]`, `recommendations[]` (prioritized), plus
  sub-scores (e.g. ATS). Every review references the exact document **version**
  it judged.
- **Version** — see §10.

All models are defined once in `packages/schema` as TS types **and** zod runtime
schemas, so LLM JSON output is validated at the boundary (and the model is asked
to retry on invalid shape).

---

## 5. LLM integration & prompt strategy

- **One prompt = one narrow judgment.** Rather than "review this resume", we run
  many small, schema-constrained prompts (extract skills; score skill X against
  evidence; assess one ATS dimension). Small prompts + JSON mode are far more
  reliable on a local 7B model and make each unit independently testable/mockable.
- **Structured output.** Every prompt ends with a strict JSON schema and an
  example. Output is parsed and zod-validated; on failure we retry (the client
  already retries transient 5xx/timeout; a schema-mismatch retry is added in
  `packages/llm`).
- **Evidence-grounded scoring.** Skill/experience scoring prompts must return the
  specific resume/LinkedIn text they relied on. No evidence ⇒ low score. This is
  what powers the "why is this a stretch?" drill-down and the challenge flow.
- **Determinism.** `temperature 0`, `top_k 1`, fixed `seed`. Same inputs ⇒ same
  scores, so a re-review after an edit shows a *real* delta, not sampling noise.
- **Prompts are versioned assets** in `packages/analysis/prompts/` so changes to
  judgment behavior are reviewable in PRs.

---

## 6. Scoring & judgment

Implemented deterministically in `packages/scoring` (Phase 0 delivers the core).

- **Per-item score:** 0–100 from the LLM, grounded in cited evidence.
- **Fit tiers** (single score → one tier), default bands:
  `strong ≥85`, `reasonable ≥70`, `weak ≥50`, `very_weak ≥30`, `stretch <30`.
  Thresholds are tunable in one place (`DEFAULT_THRESHOLDS`).
- **"Stretch" wording:** internally we keep the precise tier, but user-facing
  phrasing softens `weak`/`very_weak`/`stretch` to *"a stretch"* — the polite way
  to say weak fit, per the spec. (`describeFit`, `isStretch`.)
- **Aggregate fit:** weighted average with **required** items weighted above
  **preferred** (`DEFAULT_WEIGHTS` = 2:1). Produces `overallScore`, `overallTier`,
  a per-tier count breakdown, and **critical gaps** (required items that are a
  stretch) — the things most likely to sink the application.
- **Challenge flow** (Phase 4): user disputes a score → app asks targeted
  questions → weighs the new evidence with a dedicated prompt → if credible,
  recommends adding it to the resume/LinkedIn (and re-scores); if not, explains
  precisely what is missing. The judgment is a prompt; the *record* of the
  challenge and any resulting edit is versioned.

---

## 7. ATS optimization (Phase 2)

A distinct review with its own score and rubric, covering documented ATS
best practices: parseable single-column-friendly structure, standard section
headings, no text-in-images/tables that break parsing, contact block placement,
file-format guidance, date formatting, and — crucially — **keyword coverage**
matched against a target job description (reuses §6 matching). Output: ATS score,
strengths, weaknesses, and concrete before/after change recommendations.

---

## 8. Document ingestion & generation (`packages/documents`)

- **Ingest:** PDF → text (e.g. `pdf-parse`/`pdfjs`), DOCX → text/structure (e.g.
  `mammoth`), then an LLM structuring pass into `ResumeModel`.
- **Generate:** `ResumeModel` → DOCX (via the `docx` library) and → PDF. DOCX is
  the source of truth for generation; PDF is produced from it. Generation is
  **template-driven and deterministic** so output diffs are meaningful and
  ATS-safe (no images/complex tables).
- Cover letters generate from a template + job/company + selected resume evidence.
- Every generated artifact is written **through the version store** (§10) and
  accompanied by an **explanation page** listing each change and its rationale.

---

## 9. LinkedIn approach (`packages/linkedin`, Phase 6 ✅)

**Finding:** LinkedIn offers no supported third-party API to edit a personal
profile; automated scraping/writing violates the LinkedIn User Agreement and can
trigger account restrictions. Design accordingly:

- **Default path (safe):** the user provides their profile as a saved PDF export
  or pasted text. `importLinkedInProfile` parses it, `reviewLinkedIn` reviews it,
  and `buildLinkedInChangeSet` outputs **copy-paste-ready** rewritten text per
  field plus **step-by-step** "where to click" instructions. No automation.
- **Optional assisted fill (off by default):** `applyLinkedInChanges` takes an
  `AssistedFillDriver` and refuses unless `enabled: true` (mirrors
  `LINKEDIN_ASSISTED_FILL`) **and** each change passes a per-change `confirm`
  callback (which defaults to rejecting). No real browser driver ships in the
  engine — the interface exists so the flow is testable and so any future driver
  is confirmation-gated by construction. It is a convenience wrapper over the
  safe path, never a replacement for it.

---

## 10. Versioning — app-level snapshot store (`packages/versioning`)

A local, file-based store (default `.data/`, gitignored) that records every
change to any document and every recommendation set.

- **Snapshot:** immutable JSON per version: `{ id, target, parentId, createdAt,
  source ('user'|'generated'|'reverted'), content (structured), rawFilePath?,
  reviewId?, note }`. Chained by `parentId` into a history tree (supports
  branching, e.g. per-job tailored variants).
- **Operations:** `save`, `list(target)`, `get(id)`, `diff(a,b)` (structured,
  field-level diff — not a binary docx diff), `revert(id)` (creates a new
  version whose content equals an old one; history is append-only, never
  rewritten).
- **Why app-level, not git:** structured field-level diffs are far more useful
  than binary docx/pdf diffs, and revert-as-new-version keeps an auditable trail
  without git plumbing. (An optional `export --to-git` can be added later.)
- Determinism of generation (§8) means the diff between two versions reflects
  *intended* edits only.

---

## 11. Web app (`web/`, Phase 5b ✅; polished in Phase 7)

Next.js 14 (App Router) app wrapping the engine. Route handlers under
`app/api/*` (`analyze`, `generate`, `versions`, `health`) run server-side
(`runtime = "nodejs"`) and call the engine directly; a single client page renders
the results. Delivered screens: paste resume/job → resume review + ATS panel →
**job-fit dashboard** (per-item scores, critical gaps) → tailored DOCX
**downloads** → **version history with diff + revert**. Next consumes the
TypeScript engine packages via `transpilePackages` + a webpack `extensionAlias`
that maps the packages' `.js` import specifiers to their `.ts` sources; heavy
server-only libs (`unpdf`, `mammoth`, `pdf-lib`, `docx`) are kept external.

The web shell was split out of the original Phase 5 into its own phase (5b) so the
engine (requirements 4/5/10/11) shipped first, fully unit-tested; the UI then
wraps a proven engine. CI runs `next build` (compile + typecheck) as the web
gate — no model is called at build time. **Phase 7** added file upload
(`/api/ingest`), a one-click guided flow over `packages/workflow`
(`/api/workflow`), a Coach page (`/api/challenge`, `/api/improve`), and a
LinkedIn page (`/api/linkedin`), plus site nav and empty/error states.

## 11a. End-to-end workflow (`packages/workflow`, Phase 7 ✅)

`runTailoringWorkflow(input, client, store)` composes the whole pipeline as one
engine function: resume review → ATS → job fit → cover letter → tailored
documents → (optional) LinkedIn change set → versioned snapshots, calling each
LLM step once. It is the "one guided flow" both the web app (`/api/workflow`) and
future automation use, and is covered by an end-to-end integration test that
drives every package together with a single fake client and a temp store.

---

## 12. Privacy, security & safety

- **PII stays local:** all analysis uses the self-hosted LLM endpoint; `.env` and
  `.data/` are gitignored so resumes/profiles are never committed.
- **No secret logging.** No profile content in telemetry/logs beyond what the user
  views.
- **No prohibited actions:** the app never enters credentials or submits forms on
  the user's behalf without explicit per-action confirmation; the LinkedIn
  assisted-fill flow is opt-in and confirmation-gated (§9).
- **Untrusted input:** job-description HTML/URLs are treated as data, never as
  instructions to the app or the model (prompt-injection guarding in `ingest`).

---

## 13. Testing strategy (git-level, per PR)

- **Deterministic core is unit-tested** with `node:test` + `tsx`: scoring/tiers
  (Phase 0 ✅), schema validation, structured diff, version save/revert, document
  structuring transforms, JD parsing on saved fixtures.
- **LLM-backed behavior is tested with fake `ChatClient`s** (routing canned JSON
  by prompt), including an **end-to-end workflow test** that drives every package
  together. Live-endpoint evals **self-skip in CI** (no model reachable), exactly
  like `job-preparation`'s eval-gate, and run locally with fixed seeds.
- **CI gate** (`.github/workflows/ci.yml`): `npm ci` → typecheck all packages →
  unit tests with coverage floors → `next build` (compiles + type-checks the web
  shell). Every phase adds tests; the coverage floor keeps them honest.
- **Fixtures over live network:** JD ingestion is tested against saved HTML
  fixtures so tests are hermetic and don't hit real job sites.

---

## 14. Configuration

All via `.env` (see `.env.example`): `LLM_*` for the model endpoint, `DATA_DIR`
for the store, `LINKEDIN_ASSISTED_FILL` for the opt-in automation. No secrets in
source; nothing about a specific person in the repo.
