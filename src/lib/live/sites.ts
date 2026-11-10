// Площадки живого режима на сервере (data/sites.json): их видит и веб-приложение, и ежечасный агент,
// который работает без открытого браузера. Файл не в git.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { siteInputErrors } from "../siteForm";
import type { AddSiteResult, Site, SiteInput } from "../types";
import { LIVE_NODES, LIVE_SEED_SITES } from "./catalog";
import { agentDir, createFileStore } from "../agent/store";

export const SITES_FILE = join(process.cwd(), "data", "sites.json");

export function readSites(file = SITES_FILE): Site[] {
  if (!existsSync(/*turbopackIgnore: true*/ file)) {
    writeSites(LIVE_SEED_SITES, file);
    return LIVE_SEED_SITES;
  }
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8"));
  } catch {
    data = null;
  }
  // Повреждённый файл не затираем и не считаем пустым списком: ошибка видна на экране и в логе агента.
  if (!Array.isArray(data)) throw new Error(`${file} is damaged: fix or delete it (the app recreates example sites)`);
  return data as Site[];
}

export function writeSites(sites: Site[], file = SITES_FILE): void {
  if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(sites, null, 2));
  renameSync(tmp, file);
}

function check(input: SiteInput): AddSiteResult | null {
  const errors = siteInputErrors(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "invalid", message: `Check the highlighted fields: ${Object.values(errors).join("; ")}.` };
  }
  if (input.kind === "grid" && !LIVE_NODES.some((n) => n.id === input.nodeId)) {
    return {
      ok: false,
      error: "node-not-found",
      message: `Zone "${input.nodeId}" isn't available yet. Pick one of ${LIVE_NODES.map((n) => n.id).join(", ")} or use My tariff.`,
    };
  }
  return null;
}

function labelOf(input: SiteInput): string {
  if (input.kind !== "grid") return input.nodeLabel;
  return input.nodeLabel.trim() || LIVE_NODES.find((n) => n.id === input.nodeId)?.label || input.nodeId || "";
}

/** id, которые уже встречаются в истории агента: новой площадке их не даём, чтобы она не унаследовала чужую историю. */
function historyIds(): Set<string> {
  try {
    return new Set(createFileStore(agentDir("live")).readDecisions().map((r) => r.siteId));
  } catch {
    return new Set();
  }
}

export function addSite(input: SiteInput, file = SITES_FILE, usedIds: () => Set<string> = historyIds): AddSiteResult {
  const bad = check(input);
  if (bad) return bad;
  const sites = readSites(file);
  const used = usedIds();
  // Короткий id: он попадает в кнопки Telegram, а у них лимит 64 байта на данные.
  const base = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32).replace(/-$/, "") || "site";
  let id = base;
  for (let n = 2; sites.some((s) => s.id === id) || used.has(id); n++) id = `${base}-${n}`;
  const site: Site = { ...input, id, name: input.name.trim(), nodeLabel: labelOf(input), lastDecision: null };
  writeSites([...sites, site], file);
  return { ok: true, site };
}

export function updateSite(id: string, input: SiteInput, file = SITES_FILE): AddSiteResult | null {
  const sites = readSites(file);
  const i = sites.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const bad = check(input);
  if (bad) return bad;
  const site: Site = { ...input, id, name: input.name.trim(), nodeLabel: labelOf(input), lastDecision: null };
  writeSites(sites.map((s, j) => (j === i ? site : s)), file);
  return { ok: true, site };
}

export function deleteSite(id: string, file = SITES_FILE): boolean {
  const sites = readSites(file);
  const next = sites.filter((s) => s.id !== id);
  if (next.length === sites.length) return false;
  writeSites(next, file);
  return true;
}
