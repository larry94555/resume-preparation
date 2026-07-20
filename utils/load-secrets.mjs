#!/usr/bin/env node
// Minimal, dependency-free secrets loader (mirrors job-preparation's pattern).
//
// Model configuration (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, …) can live in ONE
// of two places:
//   • Locally: a gitignored `secrets/secrets.env` file (KEY=value, # comments).
//   • Outside the repo: real environment variables (your shell, CI, a host).
//
// This loader reads the local file and copies each pair into process.env — but
// NEVER overrides a variable already set, so externally-provided values win.
//
// It also maps a few FRIENDLY ALIASES onto the canonical `LLM_*` names the model
// client reads, so a hosted-server secrets file can use `LLAMA_SERVER_URL` /
// `API_KEY` and still "just work".
//
// Usage:
//   • Preload before a tool (no output):
//       node --import ./utils/load-secrets.mjs your-script.ts
//     (the review/match/coach/generate/linkedin npm scripts already do this)
//   • Inspect what it would load (masked summary):
//       node utils/load-secrets.mjs        # (npm run secrets:check)

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { probeModel } from "./probe-model.mjs";

// Friendly alias → canonical env var the LlamaClient understands.
const ALIASES = {
  LLAMA_SERVER_URL: "LLM_BASE_URL",
  LLAMA_BASE_URL: "LLM_BASE_URL",
  LLM_SERVER_URL: "LLM_BASE_URL",
  API_KEY: "LLM_API_KEY",
  LLAMA_API_KEY: "LLM_API_KEY",
  LLAMA_MODEL: "LLM_MODEL",
  LLAMA_TIMEOUT_MS: "LLM_TIMEOUT_MS",
  LLAMA_MAX_TOKENS: "LLM_MAX_TOKENS",
  LLAMA_SEED: "LLM_SEED",
};

/** Keys whose values should be masked in the summary output. */
const SECRET_KEYS = /API_KEY|TOKEN|SECRET|PASSWORD/i;

/** Parse a KEY=value / .env-style file into pairs (ignoring blanks/comments). */
function parse(text) {
  const pairs = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    pairs.push([key, val]);
  }
  return pairs;
}

function setIfUnset(key, val, loaded) {
  if (val === "" || val === undefined) return;
  if (process.env[key] === undefined) {
    process.env[key] = val;
    loaded.push(key);
  }
}

/** Resolve the repo root from this module's location (…/utils/load-secrets.mjs). */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Load secrets from `file` (default `<repo>/secrets/secrets.env`, override with
 * SECRETS_FILE) into process.env, without overriding existing values, applying
 * the friendly aliases above. Returns { found, path, loaded, skipped }.
 */
export function loadSecrets(file = process.env.SECRETS_FILE ?? resolve(REPO_ROOT, "secrets/secrets.env")) {
  const path = resolve(file);
  if (!existsSync(path)) return { found: false, path, loaded: [], skipped: [] };

  const loaded = [];
  const skipped = [];
  for (const [key, val] of parse(readFileSync(path, "utf8"))) {
    const before = process.env[key] !== undefined;
    setIfUnset(key, val, loaded); // keep the raw key too
    const canonical = ALIASES[key];
    if (canonical && canonical !== key) setIfUnset(canonical, val, loaded);
    if (before) skipped.push(key);
  }
  return { found: true, path, loaded: [...new Set(loaded)], skipped };
}

// Always load on import (this is the preload entry point).
const result = loadSecrets();

// When run directly (`node utils/load-secrets.mjs`, i.e. `npm run secrets:check`),
// print a masked summary AND actually ping the model so you can see whether it's
// reachable and, if not, exactly why.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  void (async () => {
    if (!result.found) {
      console.log(`No secrets file at ${result.path} — using ambient environment only.`);
      console.log(`Create one from secrets/secrets.env.example to use a hosted or local model.`);
    } else {
      console.log(`Secrets file: ${result.path}`);
      const show = result.loaded.map((k) => (SECRET_KEYS.test(k) ? `${k}=****` : k));
      console.log(`  loaded into env: ${show.join(", ") || "(none)"}`);
      if (result.skipped.length) {
        console.log(`  kept from env (not overridden): ${[...new Set(result.skipped)].join(", ")}`);
      }
    }
    console.log(`  effective LLM_BASE_URL: ${process.env.LLM_BASE_URL ?? "(unset)"}`);
    console.log(`  LLM_API_KEY: ${process.env.LLM_API_KEY ? "set" : "(unset)"}`);

    process.stdout.write(`  pinging model… `);
    const probe = await probeModel();
    console.log(probe.ok ? `✅ reachable (${probe.detail})` : `❌ NOT reachable — ${probe.detail}`);
  })();
}
