import type { Site } from "./types";

const ZONE_FLAG: Record<string, string> = {
  "DE-LU": "🇩🇪",
  FR: "🇫🇷",
  PL: "🇵🇱",
  AT: "🇦🇹",
  NL: "🇳🇱",
  BE: "🇧🇪",
};

/** Флаг страны площадки по зоне рынка; у тарифа без привязки к стране флага нет. */
export function siteFlag(site: Pick<Site, "kind" | "nodeId">): string | null {
  if (site.kind !== "grid" || !site.nodeId) return null;
  if (ZONE_FLAG[site.nodeId]) return ZONE_FLAG[site.nodeId];
  if (site.nodeId.startsWith("HB_")) return "🇺🇸";
  return null;
}
