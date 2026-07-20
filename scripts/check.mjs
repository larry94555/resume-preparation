#!/usr/bin/env node
// Friendly setup check: runs the unit tests (no model needed) and ends with a
// clear verdict so you know whether you're good to continue the walkthrough.
//   npm run check

import { spawn } from "node:child_process";

const line = "─".repeat(64);
const testArgs = ["--import", "tsx", "--test", "packages/**/*.test.ts"];

function fail(reason) {
  console.log(`\n${line}`);
  console.log(`❌  PLEASE FIX — ${reason}`);
  console.log("    • Did you run `npm ci` first?");
  console.log("    • Are you on Node 22 or newer?  Check with:  node --version");
  console.log("    • Scroll up to the first line starting with `✖` to see which test failed.");
  console.log(line);
  process.exit(1);
}

console.log("Running unit tests (no model needed — this just checks your setup)…\n");

const child = spawn(process.execPath, testArgs, { stdio: "inherit" });

child.on("error", (err) => fail(`could not start the test runner: ${err.message}`));

child.on("exit", (code) => {
  if (code === 0) {
    console.log(`\n${line}`);
    console.log("✅  READY TO GO — all unit tests passed.");
    console.log("    (A few live-model checks self-skip; that's expected and fine.)");
    console.log("    Next: put your model settings in  secrets/secrets.env  and continue");
    console.log("    the walkthrough (Local_Walkthrough.md).");
    console.log(line);
    return;
  }
  fail(`some unit tests failed (exit code ${code}).`);
});
