import { LlamaClient } from "@resume-prep/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirm the model is not just reachable but actually GENERATING. Does a tiny
 * uncached "say hello" completion (which also warms a cold model into memory).
 * Small output + a moderate timeout keep it snappy on load. NOT cached — it must
 * test the live model on every check.
 */
export async function GET() {
  const client = new LlamaClient({ maxTokens: 8, timeoutMs: 45000 });

  const reach = await client.reach();
  if (!reach.ok) {
    return Response.json({ ok: false, stage: "connect", detail: reach.detail, baseUrl: client.baseUrl });
  }

  try {
    const reply = (await client.chatText([{ role: "user", content: "Reply with just the word: Hello" }])).trim();
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
    return Response.json({
      ok: false,
      stage: "generate",
      detail: e instanceof Error ? e.message : String(e),
      baseUrl: client.baseUrl,
    });
  }
}
