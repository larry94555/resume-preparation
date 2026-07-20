// Node.js-only: load the shared secrets file into the web server's environment
// on startup. We load it INLINE (node:fs) rather than importing
// utils/load-secrets.mjs, because webpack can't bundle a dynamic file:// import.
// This mirrors utils/load-secrets.mjs — keep the alias map in sync. The web app
// runs with cwd = web/, so the repo root (and secrets/) is one level up.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const file = process.env.SECRETS_FILE
  ? resolve(process.env.SECRETS_FILE)
  : resolve(process.cwd(), "..", "secrets", "secrets.env");

function setIfUnset(key, val) {
  // Never override a value already set in the environment (external wins).
  if (val && process.env[key] === undefined) process.env[key] = val;
}

if (existsSync(file)) {
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
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
    setIfUnset(key, val);
    const canonical = ALIASES[key];
    if (canonical && canonical !== key) setIfUnset(canonical, val);
  }
  console.log(`[secrets] loaded ${file} — LLM_BASE_URL=${process.env.LLM_BASE_URL ?? "(unset)"}`);
} else {
  console.log(`[secrets] no file at ${file} — using ambient environment (set one up from secrets/secrets.env.example).`);
}
