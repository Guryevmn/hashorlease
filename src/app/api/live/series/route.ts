import { getLiveSeries, LIVE_NODES } from "@/lib/live/market";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const node = new URL(req.url).searchParams.get("node") ?? "";
  if (!LIVE_NODES.some((n) => n.id === node)) return Response.json({ error: "unknown node" }, { status: 404 });
  try {
    return Response.json(await getLiveSeries(node));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 502 });
  }
}
