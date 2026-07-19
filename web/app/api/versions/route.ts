import { getStore } from "../../../lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?target=resume → history; GET ?from=<id>&to=<id> → structured diff. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = getStore();

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && to) {
    return Response.json({ diff: await store.diff(from, to) });
  }

  const target = url.searchParams.get("target") ?? "resume";
  const history = await store.history(target);
  return Response.json({
    history: history.map((s) => ({
      id: s.id,
      target: s.target,
      kind: s.kind,
      createdAt: s.createdAt,
      source: s.source,
      parentId: s.parentId,
      note: s.note ?? null,
    })),
  });
}

/** POST { action: "revert", id } → append a reverted snapshot. */
export async function POST(req: Request) {
  const { action, id } = (await req.json()) as { action?: string; id?: string };
  if (action !== "revert" || !id) {
    return Response.json({ error: "Expected { action: 'revert', id }." }, { status: 400 });
  }
  const snap = await getStore().revert(id);
  return Response.json({ reverted: { id: snap.id, parentId: snap.parentId, createdAt: snap.createdAt } });
}
