# Local Walkthrough — target a job end to end

**Can the full functionality be tested locally? Yes.** Every part of this app runs
on your own machine. The only moving piece besides Node is a **local,
OpenAI-compatible LLM** that you also run locally (Ollama or llama.cpp). Your
resume, LinkedIn profile, and the job description are sent only to that local
model — nothing leaves your computer, and nothing is committed to git (`.env` and
`.data/` are ignored).

This guide takes someone with **a LinkedIn profile, an existing resume, and a job
description** all the way through:

1. **Evaluate preparedness** — score every required/preferred skill and experience
   and get an overall "fit vs. stretch" verdict.
2. **Make updates** — challenge scores you think are unfair (with evidence) and get
   improvement plans for real gaps.
3. **Generate targeted documents** — a fresh ATS-friendly résumé and a tailored
   cover letter.
4. **Final gap check** — an evaluation of what's still missing between the job
   description and the résumé + cover letter you're about to submit.

There are two ways to do this: the **web app** (guided, recommended) and the
**CLIs** (scriptable). Both use the same engine; pick either. Steps for both are
below.

---

## What you'll need

- **Node 22+** — check with `node --version`.
- **A model endpoint** exposing an OpenAI-compatible `/v1` API. Two options, and
  the app works the same either way:
  - **Local** (fully offline) — [Ollama](https://ollama.com) is quickest;
    llama.cpp's `llama-server` also works.
  - **A hosted llama server over the web** — any reachable
    `llama-server` / vLLM / Ollama URL, optionally secured with an API key.
- **Your three inputs:**
  - **Résumé** — a `.pdf`, `.docx`, or plain-text file (e.g. `resume.pdf`).
  - **Job description** — provide it any of three ways:
    1. the **posting URL** (e.g. `https://…/careers/backend-engineer`);
    2. a **saved HTML page** (in your browser: *Save Page As… → Webpage, HTML
       Only*, e.g. `job.html`);
    3. the **text** pasted into a file (e.g. `job.txt`).
  - **LinkedIn profile** — on LinkedIn, open your profile → **More → Save to PDF**
    (gives `Profile.pdf`), **or** just copy your headline/About/experience text
    into `linkedin.txt`.

Put these somewhere handy, e.g. a `~/job-hunt/` folder.

---

## Step 0 — One-time setup

### 0a. (Local option) Start a local model

Skip this if you'll use a hosted server. For a local model with Ollama:

```bash
# install Ollama from https://ollama.com, then:
ollama pull llama3.1:8b      # ~5 GB; any instruct model works
ollama serve                 # serves an OpenAI-compatible API at http://localhost:11434/v1
```

Leave `ollama serve` running in its own terminal. (With llama.cpp instead:
`llama-server -m <model>.gguf --host 0.0.0.0 --port 8080 -c 4096 --parallel 1`,
serving `http://localhost:8080/v1`.)

### 0b. Point the app at your model — local **or** over the web

Configuration lives in a **gitignored secrets file** that both the CLIs and the
web app load automatically. Copy the template:

```bash
cp secrets/secrets.env.example secrets/secrets.env      # PowerShell: Copy-Item secrets/secrets.env.example secrets/secrets.env
```

Open `secrets/secrets.env` and keep **one** of these:

**Local model (Ollama):**
```ini
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.1:8b
# LLM_API_KEY=            # not needed for a local, open endpoint
```

**A llama server over the web (hosted):**
```ini
LLAMA_SERVER_URL=https://your-llama-server.example.com/v1
API_KEY=your-secret-bearer-token         # matches the server's --api-key
LLAMA_MODEL=local                         # single-model llama-server ignores this
# LLM_TIMEOUT_MS=120000                    # raise for a slow remote model
```

`LLAMA_SERVER_URL` and `API_KEY` are friendly aliases — the loader maps them to
`LLM_BASE_URL` / `LLM_API_KEY` automatically. Verify what's loaded (secrets are
masked):

```bash
npm run secrets:check
```

> Scores are pinned to `temperature 0` + a fixed seed, so re-running after an edit
> shows a real change, not noise. If you prefer, you can set `LLM_BASE_URL` /
> `LLM_API_KEY` as real shell environment variables instead — those always win
> over the file.

### 0c. Install and check

Do this **after** Step 0b (so your model is configured). `npm run check` runs the
unit tests **and pings your model**, then prints one clear verdict:

```bash
npm ci
npm run check
```

- **`✅  READY TO GO`** — tests passed and your model is reachable. Continue below.
- **`⚠️  NOT READY — … the MODEL is NOT reachable`** — the code is fine but the app
  can't reach your model. Fix `secrets/secrets.env` (or start your local model),
  then re-run. To see exactly why, run `npm run secrets:check` — it prints the
  effective `LLM_BASE_URL` and pings the endpoint.
- **`❌  PLEASE FIX`** — a unit test failed (usually `npm ci` wasn't run, or Node is
  older than 22). Follow the hints, then re-run.

(`npm test` runs the same tests without the model check or the friendly verdict.)

---

## Step 1 — Prepare your inputs

You already have them from "What you'll need." For the examples below assume:

```
resume.pdf      # your current résumé
# the job description — you only need ONE of these three:
#   a posting URL, e.g. https://example.com/careers/backend-engineer
job.html        # a saved HTML page of the posting  (Save Page As → HTML Only)
job.txt         # or the job description pasted into a text file
linkedin.txt    # your LinkedIn profile text  (or Profile.pdf from "Save to PDF")
```

---

# Track A — Web app (guided, recommended)

Start the app (in the terminal where you set the env vars in Step 0b):

```bash
npm run web:dev
```

Open **http://localhost:3000**. On load the app runs a quick "hello" test against
your model and shows **✓ LLM is accessible and working…** in the header (the first
load can take a moment while the model warms up). If it shows **✗ LLM problem**,
the reason is printed right there — revisit Step 0.

> **Repeat runs are fast (caching).** Every model result is cached by content in a
> gitignored `working/` folder. Because grading is deterministic, re-reading the
> **same** résumé (or re-running after a step failed) reuses the completed work
> instead of calling the model again — the activity log ends with
> "Reused N cached step(s)". Change the résumé/job and it re-runs only what
> changed. Delete `working/` to clear the cache; set `WORKING_DIR` to relocate it.

### A1. Load your résumé and the job

On the **Tailor** page:

- **Résumé** — click **Choose File** and pick `resume.pdf` (PDF/DOCX/txt are read
  automatically), or paste the text.
- **Job description** — pick one of the three source buttons:
  1. **URL** — paste the posting's link (the app fetches and reads it);
  2. **Saved HTML** — choose your saved `job.html` file;
  3. **Paste text** — paste the description text.
- *(Optional)* expand **"paste your LinkedIn profile"** and paste `linkedin.txt`
  to also get LinkedIn suggestions in one shot.

> **URL not working?** Some job boards block automated fetches or need JavaScript
> to render. If a URL returns little/no text, open the posting in your browser,
> **Save Page As → Webpage, HTML Only**, and use the **Saved HTML** option (or
> copy the text and **Paste text**).

### A2. Evaluate how prepared you are

Click **Analyze resume**. You'll get:

- **Résumé review** — overall score + tier, strengths, weaknesses, prioritized
  recommendations.
- **ATS** — a separate applicant-tracking score, plus keywords present vs.
  recommended.
- **Job fit** — a table scoring **each required/preferred skill and experience**
  0–100 with a tier (strong / reasonable / weak / very weak / stretch), an overall
  verdict, and **critical gaps** (required items you don't yet cover). This is your
  "how prepared am I?" answer. See [Interpreting the scores](#interpreting-the-scores).

### A3. Make updates — challenge & improve

Go to the **Coach** page (top nav):

- Paste your résumé text, type a requirement (e.g. `Kubernetes`), pick its kind and
  importance.
- **Challenge score** — if you think a low score is unfair, type your evidence
  ("I ran a 20-node production cluster for 2 years, cut deploy time 60%…") and the
  coach evaluates it. If it's credible, it **re-scores** the item and suggests a
  résumé bullet to add; if not, it tells you exactly what's missing.
- **Plan improvement** — for a genuine gap, get concrete, effort-rated actions
  (projects, certifications, on-the-job steps) to raise the score.

Apply what you learn: **edit your résumé text** to include any newly-validated
evidence / suggested bullets before generating.

### A4. Generate targeted résumé + cover letter

Back on **Tailor**, make sure the résumé box holds your **updated** text, then
click **Run full tailoring**. You'll get:

- **Download résumé .docx** — a clean, single-column, ATS-friendly résumé built
  from your content.
- **Download cover letter .docx** — a cover letter **written for this specific
  job**, grounded in your résumé.
- A **coverage** line (covered vs. missing requirements) and, if you pasted a
  LinkedIn profile, a note pointing to the **LinkedIn** tab for its change set.
- Everything is **versioned** — see **Version history** at the bottom to **diff the
  last two** versions or **revert**.

### A5. LinkedIn (optional but recommended)

On the **LinkedIn** page: paste your profile text, optionally paste the job to
tailor toward it, then:

- **Review profile** — score + strengths/weaknesses/recommendations.
- **Build change set** — copy-paste-ready rewrites for your headline, About,
  skills, and experience, each with "where to click" instructions. You paste these
  into LinkedIn yourself — the app never posts anything for you.

### A6. Final gap check before you submit

The résumé you'll submit is the one you just generated from your **edited** text.
To evaluate the remaining gap between it and the job:

1. Make sure the **Tailor** page's résumé box contains your final text.
2. Click **Analyze resume** again.
3. Read the **Job fit** table and **critical gaps**, and the **ATS → keywords
   recommended** list. Anything still red is a gap to acknowledge (or address) in
   your application. The generated cover letter already targets the job; skim it to
   confirm it speaks to the required skills.

That fit table + keyword-gap list **is** your pre-submission gap evaluation.

---

# Track B — CLI (same steps, scriptable)

Run these from the repo root, in the terminal where you set the env vars (Step 0b).
Arguments after `--` go to the tool.

### B1. Evaluate the résumé on its own

```bash
npm run review -- resume.pdf
```

Prints the résumé review (score, strengths, weaknesses, recommendations) and the
ATS review (score + keyword coverage).

### B2. Evaluate preparedness against the job (skills & experiences)

Pick whichever job source you have (URL, saved HTML, or text):

```bash
npm run match -- resume.pdf --job-url "https://example.com/careers/backend-engineer"
# or, from a saved HTML page:  npm run match -- resume.pdf --job-html job.html
# or, from pasted text:        npm run match -- resume.pdf --job-text job.txt
```

Prints per-requirement scores, tiers, cited evidence, the overall verdict, and
**critical gaps** — the "how prepared am I?" answer.

### B3. Make updates — challenge a score / plan an improvement

```bash
# Challenge a score you think is too low, with evidence:
npm run coach -- challenge resume.pdf --requirement "Kubernetes" --importance required \
  --evidence "I ran a 20-node production Kubernetes cluster for 2 years and cut deploy time 60%."

# Get an improvement plan for a real gap:
npm run coach -- improve resume.pdf --requirement "Kubernetes"
```

Challenge prints the coach's questions, the verdict (accepted/insufficient), and —
if accepted — the re-scored value and a suggested résumé bullet. Fold accepted
evidence into your résumé text/file before generating.

### B4. Generate targeted résumé + cover letter + gap explanation

Use the same three job sources — URL first:

```bash
npm run generate -- resume.pdf --job-url "https://example.com/careers/backend-engineer" --out-dir out
# or, from a saved HTML page:  npm run generate -- resume.pdf --job-html job.html --out-dir out
# or, from pasted text:        npm run generate -- resume.pdf --job-text job.txt  --out-dir out
```

Writes to `out/`:

- `tailored-resume.docx` and `tailored-resume.pdf` — ATS-friendly résumé.
- `cover-letter.docx` — cover letter written for this job.
- `explanation.docx` — **"what to strengthen and why"**: the gaps between the job
  and your résumé, each with a reason.

…and prints a **tailored score**: overall fit, ATS score, **covered** vs.
**missing** requirements, **keyword matches** vs. **keyword gaps**, and whether you
state a clear objective. Snapshots are saved under `.data/versions/`.

### B5. LinkedIn review + change set

```bash
npm run linkedin -- review    Profile.pdf
npm run linkedin -- changeset Profile.pdf --job-text job.txt
```

`changeset` prints copy-paste-ready rewrites with instructions (tailored to the
job when you pass `--job-text`). Paste them into LinkedIn yourself.

### B6. Final pre-submission gap check

After editing your résumé to reflect the recommendations and accepted evidence,
save it (e.g. `resume-final.pdf` or `resume-final.txt`) and re-run the evaluation
against the job:

```bash
npm run match    -- resume-final.txt text --job-text job.txt
npm run generate -- resume-final.txt text --job-text job.txt --out-dir out-final
```

Compare `covered` vs. `missing` and the keyword gaps in the output (and
`out-final/explanation.docx`). Remaining "missing"/critical-gap items are exactly
the gaps to weigh before you submit.

---

## Interpreting the scores

- **Fit tiers** (per skill/experience and overall): **strong ≥ 85**,
  **reasonable ≥ 70**, **weak ≥ 50**, **very weak ≥ 30**, **stretch < 30**. In
  conversation the bottom three are politely summarized as **"a stretch."**
- **Overall fit** weights **required** items above **preferred** ones, so a missing
  must-have hurts more than a missing nice-to-have.
- **Critical gaps** = *required* requirements that land in a stretch tier. These are
  the biggest risks to your application — address or acknowledge them.
- **ATS score** measures how cleanly an applicant-tracking system will parse the
  résumé (headings, dates, quantified bullets, keyword coverage). **Keywords
  recommended / keyword gaps** are terms the job expects that your résumé
  under-represents.
- Every skill/experience score cites the **evidence** it used, so you can see *why*
  it's a fit or a stretch — and challenge it (Step A3/B3) if you disagree.

---

## A realistic end-to-end sequence

1. `review` / **Analyze** — see where the résumé stands on its own.
2. `match` / **Job fit** — see exactly which skills and experiences are covered vs.
   a stretch for *this* job.
3. `coach challenge` — reclaim scores you can back with evidence; note the suggested
   bullets. `coach improve` — get a plan for the genuine gaps.
4. **Edit your résumé** to include the validated evidence and top recommendations.
5. `generate` / **Run full tailoring** — produce the ATS-friendly résumé, the
   job-specific cover letter, and the gap **explanation** page.
6. `linkedin changeset` — update your profile so it matches the story.
7. `match` / **Analyze** on the final résumé — confirm the remaining gaps you're
   knowingly submitting with.

---

## Where your data lives (and privacy)

- **Model calls** go only to your `LLM_BASE_URL` (local). No cloud.
- **Version history** is JSON under `.data/versions/` (or wherever `DATA_DIR`
  points). **Generated documents** go to your chosen `--out-dir` (default `out/`).
- `.env`, `.data/`, and `out/` are git-ignored — your personal content is never
  committed.

---

## Troubleshooting

- **Header says "model offline" / CLI prints "No LLM endpoint reachable."**
  The web header and CLIs now show the **reason** (URL + HTTP status, or the
  connection error). Run **`npm run secrets:check`** to see the effective
  `LLM_BASE_URL` and a live ping result. For a local model, confirm the server is up
  (`curl http://localhost:11434/v1/models`). For a hosted server, confirm the URL is
  reachable and the `API_KEY` matches the server's `--api-key`. The app also accepts
  servers that don't expose `/models` (it falls back to a small `/chat/completions`
  probe) and waits up to ~12s for a slower remote endpoint.
- **Edited `secrets/secrets.env` while the web app was running.** The web app
  loads the secrets file on startup, so **restart** `npm run web:dev` after
  changing it (the CLIs re-read it on every run).
- **A PDF returns little/no text.** Scanned/image-only PDFs have no extractable
  text (no OCR). Export a text-based PDF/DOCX, or paste the text.
- **"Reading your résumé" takes a long time, or fails with a timeout.** Reading
  the résumé is a single model call that converts it to structured JSON — usually
  the slowest step. Each request now allows up to **10 minutes** (default) before
  timing out; if it does time out you get a clear message. Open the **Audit** tab
  (see below) to watch each model call and its duration live and see exactly where
  the time goes. To speed things up: use a smaller/faster model or give the server
  more resources; to change the limit, set `LLM_TIMEOUT_MS` (milliseconds) in
  `secrets/secrets.env` and restart.
- **Watch the model back-and-forth.** The **Audit** page (top nav) shows every
  request/response between the app and the model — the exact prompt sent, the
  reply, whether it was served from cache, and how long it took. Turn on
  auto-refresh and run an analysis in another tab to watch calls stream in.
- **Small models sometimes return odd JSON.** The app automatically re-prompts to
  repair invalid output; a larger instruct model (e.g. an 8B) gives steadier
  results than a 1–3B one.
- **Scores feel too harsh.** That's what **challenge** is for — provide concrete,
  quantified evidence and let the coach re-evaluate.
