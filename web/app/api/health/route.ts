import { getClient } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const client = getClient();
  const r = await client.reach();
  return Response.json({ ok: r.ok, detail: r.detail, baseUrl: client.baseUrl });
}
