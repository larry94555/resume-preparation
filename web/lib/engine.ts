import { join } from "node:path";
import { LlamaClient } from "@resume-prep/llm";
import { SnapshotStore } from "@resume-prep/versioning";

/** A model client configured from the environment (LLM_BASE_URL, etc.). */
export function getClient(): LlamaClient {
  return new LlamaClient();
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
