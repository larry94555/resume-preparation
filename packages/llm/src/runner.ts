import type { z, ZodTypeAny } from "zod";
import type { ChatClient, ChatMessage } from "./client.js";
import { extractJsonObject } from "./json.js";

export interface StructuredRequest<S extends ZodTypeAny> {
  /** Optional system prompt establishing role/rules. */
  system?: string;
  /** The user prompt (task + input data). */
  user: string;
  /** Schema the completion must satisfy; its output type is the return type. */
  schema: S;
  /**
   * How many repair attempts to make when the model returns invalid JSON or a
   * shape that fails validation. Each repair feeds the specific error back to
   * the model. Default 2 (so up to 3 total attempts).
   */
  maxRepairs?: number;
}

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    /** The last raw completion, for debugging. */
    readonly lastRaw: string,
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

function formatIssues(schema: ZodTypeAny, data: unknown): string | null {
  const parsed = schema.safeParse(data);
  if (parsed.success) return null;
  return parsed.error.issues
    .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
    .join("; ");
}

/**
 * Run a prompt and return a value validated against `schema`. This is the single
 * choke point for every LLM-backed judgment in the app: it keeps output
 * structured and typed, and — because it accepts any {@link ChatClient} — lets
 * higher-level features be unit-tested with a canned fake instead of a live
 * model.
 *
 * On malformed/invalid output it re-prompts with the exact validation error, so
 * a small local model gets a concrete correction rather than a fresh guess.
 */
export async function runStructured<S extends ZodTypeAny>(
  client: ChatClient,
  req: StructuredRequest<S>,
): Promise<z.infer<S>> {
  const maxRepairs = req.maxRepairs ?? 2;
  const messages: ChatMessage[] = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.user });

  let lastRaw = "";
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const raw = await client.chatJson(messages);
    lastRaw = raw;

    const jsonText = extractJsonObject(raw);
    if (jsonText === null) {
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content:
          "That response did not contain a JSON object. Reply with ONLY a single valid JSON object and nothing else.",
      });
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(jsonText);
    } catch {
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content:
          "That JSON could not be parsed. Reply with ONLY a single valid JSON object and nothing else.",
      });
      continue;
    }

    const parsed = req.schema.safeParse(data);
    if (parsed.success) return parsed.data;

    const issues = formatIssues(req.schema, data) ?? "unknown validation error";
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: `The JSON did not match the required schema. Fix these problems and reply with ONLY the corrected JSON object: ${issues}`,
    });
  }

  throw new StructuredOutputError(
    `model did not produce schema-valid JSON after ${maxRepairs + 1} attempt(s)`,
    lastRaw,
  );
}
