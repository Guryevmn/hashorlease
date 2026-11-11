import { getLiveSnapshot } from "@/lib/live/market";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    // A purchase by button at most once every 2 minutes; the agent refreshes the snapshot itself.
    return Response.json(await getLiveSnapshot(force, { minForceIntervalMs: 120_000 }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 502 });
  }
}
