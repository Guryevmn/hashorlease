import type { Metadata } from "next";
import { DemoDayView } from "@/components/DemoDayView";
import { demoBreakEvenPower, demoSiteLine, simulateDemoDay } from "@/lib/demo/day";

export const metadata: Metadata = {
  title: "Demo day · Hash or Lease",
  description: "One invented site and one simulated day of prices: watch the hourly call change. Demo data only.",
};

/** The demo day is deterministic and needs no network: it is computed on the server with the real agent cycle. */
export default async function DemoDayPage() {
  const day = await simulateDemoDay();
  const breakEven = day.hours.reduce((s, x) => s + demoBreakEvenPower(x, day.site), 0) / day.hours.length;
  return <DemoDayView day={day} siteLine={demoSiteLine(day.site)} breakEven={breakEven} />;
}
