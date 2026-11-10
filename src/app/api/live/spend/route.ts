import { liveSpendState } from "@/lib/live/spend";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(liveSpendState());
}
