import { agentDir, agentStatus, createFileStore } from "@/lib/agent/store";

export const dynamic = "force-dynamic";

/** Hourly agent state: last cycle, number of cycles and paid requests today. */
export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("mode") === "live" ? "live" : "mock";
  return Response.json(agentStatus(mode, createFileStore(agentDir(mode))));
}
