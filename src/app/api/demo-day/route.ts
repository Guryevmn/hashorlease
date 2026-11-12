import { simulateDemoDay } from "@/lib/demo/day";

/** The demo-day journal as JSONL: the same records `npm run demo:day` writes to data/agent/demo/decisions.jsonl. Invented numbers, mode "demo". */
export async function GET() {
  const day = await simulateDemoDay();
  return new Response(day.decisions.map((r) => JSON.stringify(r)).join("\n") + "\n", {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": 'attachment; filename="hash-or-lease-demo-day-decisions.jsonl"',
    },
  });
}
