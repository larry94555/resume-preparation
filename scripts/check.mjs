#!/usr/bin/env node
// Friendly setup check: runs the unit tests AND pings your model, then prints a
// clear verdict so you know whether you're truly good to go.
//   npm run check

import "../utils/load-secrets.mjs"; // populate env from secrets/secrets.env (if present)
import { spawn } from "node:child_process";
import { probeModel } from "../utils/probe-model.mjs";

const line = "─".repeat(64);
const testArgs = ["--import", "tsx", "--test", "packages/**/*.test.ts"];

function banner(lines) {
  console.log(`\n${line}`);
  for (const l of lines) console.log(l);
  console.log(line);
}

console.log("1/2  Running unit tests (no model needed)…\n");

// Run the tests WITHOUT the model env vars so the live-model tests self-skip and
// this stays fast. (We keep them in this process for the model ping below.)
const testEnv = { ...process.env };
for (const key of Object.keys(testEnv)) {
  if (/^(LLM_|LLAMA_)/.test(key) || key === "API_KEY") delete testEnv[key];
}

const child = spawn(process.execPath, testArgs, { stdio: "inherit", env: testEnv });

child.on("error", (err) => {
  banner([`❌  PLEASE FIX — could not start the test runner: ${err.message}`]);
  process.exit(1);
});

child.on("exit", async (code) => {
  if (code !== 0) {
    banner([
      `❌  PLEASE FIX — some unit tests failed (exit code ${code}).`,
      "    • Did you run `npm ci` first, on Node 22+ (`node --version`)?",
      "    • Scroll up to the first line starting with `✖` to see which test failed.",
    ]);
    process.exit(1);
  }

  console.log("\n2/2  Checking your model connection…");
  const probe = await probeModel();

  if (probe.ok) {
    banner([
      "✅  READY TO GO — unit tests passed AND your model is reachable.",
      `    Model: ${probe.detail}`,
      "    Continue the walkthrough (Local_Walkthrough.md).",
    ]);
    return;
  }

  banner([
    "⚠️  NOT READY — unit tests passed, but the MODEL is NOT reachable.",
    `    ${probe.detail}`,
    "    The app's core features need a model. Fix your model, then re-run:",
    "      • Edit  secrets/secrets.env  (copy from secrets/secrets.env.example).",
    "      • Local model: is `ollama serve` running?  Try:  npm run secrets:check",
    "      • Hosted server: is the URL reachable and the API_KEY correct?",
  ]);
  process.exit(1);
});
