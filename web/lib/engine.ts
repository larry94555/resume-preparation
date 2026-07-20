import { join } from "node:path";
import { CachingChatClient } from "@resume-prep/cache";
import { DiskCache } from "@resume-prep/cache";
import { LlamaClient } from "@resume-prep/llm";
import { SnapshotStore } from "@resume-prep/versioning";

/** A model client configured from the environment (LLM_BASE_URL, etc.). */
export function getClient(): LlamaClient {
  return new LlamaClient();
}

/** Where cached model results live (default `working/`; override with WORKING_DIR). */
export function workingDir(): string {
  return process.env.WORKING_DIR ?? "working";
}

/**
 * A caching wrapper over the model client for the engine calls. Because the app
 * pins temperature 0 + a fixed seed, identical requests (e.g. re-reading the same
 * résumé) are served from `working/` instead of re-running the model — and any
 * step that already succeeded is never repeated, even if a later step failed.
 * Returns the {@link CachingChatClient} so callers can read `.stats`.
 */
export function getChat(client: LlamaClient): CachingChatClient {
  return new CachingChatClient(client, new DiskCache(workingDir()), client.model);
}

/** The snapshot store rooted at DATA_DIR (default `.data`). */
export function getStore(): SnapshotStore {
  const dataDir = process.env.DATA_DIR ?? ".data";
  return new SnapshotStore({ dir: join(dataDir, "versions") });
}

/** Standard JSON error response for an unreachable model endpoint. */
export function noModelResponse(): Response {
  return Response.json(
    { error: "No LLM endpoint reachable. Set LLM_BASE_URL and start your model server." },
    { status: 503 },
  );
}

/**
 * Gate a route on model reachability. Returns a 503 Response with the concrete
 * reason (URL, HTTP status, or connection error) when the model can't be reached,
 * or null when it's good to proceed.
 */
export async function requireModel(client: LlamaClient): Promise<Response | null> {
  const r = await client.reach();
  if (r.ok) return null;
  return Response.json({ error: `No LLM endpoint reachable — ${r.detail}` }, { status: 503 });
}
