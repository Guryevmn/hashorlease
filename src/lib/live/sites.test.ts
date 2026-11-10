import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addSite, deleteSite, readSites, updateSite } from "./sites";
import { sanitizeSiteInput } from "../siteForm";
import { LIVE_SEED_SITES } from "./catalog";

const file = () => join(mkdtempSync(join(tmpdir(), "hol-sites-")), "sites.json");
const good = { kind: "grid", name: "Paris Farm", nodeId: "FR", nodeLabel: "", mw: 10, phs: 500, jPerTh: 20, lease: null, thresholdUsdPerMwh: 5 };

describe("площадки на сервере (data/sites.json)", () => {
  it("первый запуск — стартовые площадки; добавление, правка, удаление", () => {
    const f = file();
    expect(readSites(f).map((s) => s.id)).toEqual(LIVE_SEED_SITES.map((s) => s.id));
    const added = addSite(sanitizeSiteInput(good)!, f, () => new Set());
    expect(added.ok && added.site.id).toBe("paris-farm");
    expect(added.ok && added.site.nodeLabel).toBe("France (FR), day-ahead");
    const upd = updateSite("paris-farm", sanitizeSiteInput({ ...good, mw: 12 })!, f);
    expect(upd && upd.ok && upd.site.mw).toBe(12);
    expect(updateSite("nope", sanitizeSiteInput(good)!, f)).toBeNull();
    expect(deleteSite("paris-farm", f)).toBe(true);
    expect(deleteSite("paris-farm", f)).toBe(false);
    expect(readSites(f)).toHaveLength(LIVE_SEED_SITES.length);
  });

  it("неверный ввод и недоступная зона — понятная ошибка, файл не меняется", () => {
    const f = file();
    const bad = addSite(sanitizeSiteInput({ ...good, jPerTh: 2 })!, f);
    expect(bad).toMatchObject({ ok: false, error: "invalid" });
    expect(!bad.ok && bad.message).toContain("2 J/TH is below any known miner");
    const ercot = addSite(sanitizeSiteInput({ ...good, nodeId: "HB_HOUSTON" })!, f);
    expect(ercot).toMatchObject({ ok: false, error: "node-not-found" });
    expect(readSites(f)).toHaveLength(LIVE_SEED_SITES.length);
  });

  it("тело запроса чистится: лишние поля отброшены, мусор отклонён", () => {
    expect(sanitizeSiteInput(null)).toBeNull();
    expect(sanitizeSiteInput({ kind: "boat" })).toBeNull();
    const s = sanitizeSiteInput({ ...good, mw: "10", evil: "<script>", lastDecision: "mine" })!;
    expect(s.mw).toBe(10);
    expect("evil" in s).toBe(false);
    expect("lastDecision" in s).toBe(false);
  });
});

describe("защита данных площадок", () => {
  it("повреждённый файл — ошибка, а не пустой список, и он не перезаписывается", () => {
    const f = file();
    writeFileSync(f, "{oops");
    expect(() => readSites(f)).toThrow(/damaged/);
    expect(() => addSite(sanitizeSiteInput(good)!, f, () => new Set())).toThrow(/damaged/);
  });

  it("id короткий и не повторяет id из истории агента", () => {
    const f = file();
    const long = addSite(sanitizeSiteInput({ ...good, name: "A very long site name that goes on and on and on forever" })!, f, () => new Set());
    expect(long.ok && long.site.id.length).toBeLessThanOrEqual(32);
    const reused = addSite(sanitizeSiteInput({ ...good, name: "Old Farm" })!, f, () => new Set(["old-farm"]));
    expect(reused.ok && reused.site.id).toBe("old-farm-2");
  });
});
