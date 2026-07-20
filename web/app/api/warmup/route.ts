import { randomUUID } from "node:crypto";
import { LlamaClient } from "@resume-prep/llm";
import { auditRecorder } from "../../../lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirm the model is not just reachable but actually GENERATING. Does a tiny
 * uncached "say hello" completion (which also warms a cold model into memory).
 * Small output + a moderate timeout keep it snappy on load. NOT cached — it must
 * test the live model on every check. Recorded in the audit trail so you can see
 * this initial test too.
 */
export async function GET() {
  const client = new LlamaClient({ maxTokens: 8, timeoutMs: 60000 });

  const reach = await client.reach();
  if (!reach.ok) {
    return Response.json({ ok: false, stage: "connect", detail: reach.detail, baseUrl: client.baseUrl });
  }

  const record = auditRecorder();
  const messages = [{ role: "user" as const, content: "Reply with just the word: Hello" }];
  const id = randomUUID();
  record({ phase: "start", id, at: new Date().toISOString(), kind: "text", model: client.model, messages });
  const started = Date.now();

  try {
    const reply = (await client.chatText(messages)).trim();
    record({ phase: "end", id, at: new Date().toISOString(), durationMs: Date.now() - started, cached: false, completion: reply });
    if (!reply) {
      return Response.json({
        ok: false,
        stage: "generate",
        detail: "reachable, but the model returned an empty reply",
        baseUrl: client.baseUrl,
      });
    }
    return Response.json({
      ok: true,
      detail: `replied “${reply.slice(0, 40)}”`,
      baseUrl: client.baseUrl,
      model: client.model,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    record({ phase: "end", id, at: new Date().toISOString(), durationMs: Date.now() - started, cached: false, completion: "", error: detail });
    return Response.json({ ok: false, stage: "generate", detail, baseUrl: client.baseUrl });
  }
}
