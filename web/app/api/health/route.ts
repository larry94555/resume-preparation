import { getClient } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await getClient().health();
  return Response.json({ ok });
}
