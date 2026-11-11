import type { Site } from "./types";

const ZONE_FLAG: Record<string, string> = {
  "DE-LU": "🇩🇪",
  FR: "🇫🇷",
  PL: "🇵🇱",
  AT: "🇦🇹",
  NL: "🇳🇱",
  BE: "🇧🇪",
};

/** Flag of the site's country by market zone; a tariff with no country has no flag. */
export function siteFlag(site: Pick<Site, "kind" | "nodeId">): string | null {
  if (site.kind !== "grid" || !site.nodeId) return null;
  if (ZONE_FLAG[site.nodeId]) return ZONE_FLAG[site.nodeId];
  if (site.nodeId.startsWith("HB_")) return "🇺🇸";
  return null;
}
