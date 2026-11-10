import { getLiveSnapshot } from "@/lib/live/market";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    // Покупка по кнопке не чаще раза в 2 минуты; агент обновляет снимок сам.
    return Response.json(await getLiveSnapshot(force, { minForceIntervalMs: 120_000 }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 502 });
  }
}
