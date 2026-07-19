/**
 * Next.js server startup hook. Loads the shared `secrets/secrets.env` file into
 * the server's environment (same file the CLIs use), so the web app can talk to
 * a local model or a hosted llama server without exporting env vars by hand.
 *
 * The Node-only loading lives in a sibling module imported ONLY on the Node.js
 * runtime, so the Edge bundle never sees `node:` imports.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node.mjs");
  }
}
