// Node.js-only: load the shared secrets file on server startup. Imported only
// from instrumentation.ts's `nodejs` branch, so `node:` imports never reach the
// Edge bundle. The web app runs with cwd = web/, so the loader is one level up;
// we import it by absolute file URL so the loader's own path resolution (and
// Node fs) work regardless of how Next bundles this file.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const loader = resolve(process.cwd(), "..", "utils", "load-secrets.mjs");
await import(pathToFileURL(loader).href);
