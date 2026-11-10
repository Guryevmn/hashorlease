import { agentDir, agentStatus, createFileStore } from "@/lib/agent/store";

export const dynamic = "force-dynamic";

/** Состояние ежечасного агента: последний цикл, сколько циклов и платных запросов сегодня. */
export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("mode") === "live" ? "live" : "mock";
  return Response.json(agentStatus(mode, createFileStore(agentDir(mode))));
}
