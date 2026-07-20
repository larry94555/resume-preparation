import { clearAudit, readAudit } from "../../../lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → the recent model round-trips (oldest → newest). */
export async function GET() {
  return Response.json({ entries: await readAudit(200) });
}

/** DELETE → clear the audit log. */
export async function DELETE() {
  await clearAudit();
  return Response.json({ ok: true });
}
