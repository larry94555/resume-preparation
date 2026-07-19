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
