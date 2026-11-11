import { agentDir, createFileStore, hourlyRows } from "@/lib/agent/store";

export const dynamic = "force-dynamic";

/** Agent decisions for the last N hours (one entry per site and hour). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "live" ? "live" : "mock";
  const hours = Math.min(Math.max(Number(url.searchParams.get("hours")) || 24, 1), 24 * 31);
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const rows = hourlyRows(createFileStore(agentDir(mode)).readDecisions()).filter((r) => r.hour >= since);
  return Response.json(rows);
}
