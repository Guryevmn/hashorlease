import { describe, expect, it } from "vitest";
import { decide, type DecisionInput, type DecisionOutcome } from "./decision";

function ok(input: DecisionInput): DecisionOutcome {
  const r = decide(input);
  if (!r.ok) throw new Error("expected ok, got errors: " + r.errors.join("; "));
  return r;
}

const houston: DecisionInput = {
  hashpriceUsdPerPhDay: 38.5,
  powerPriceUsdPerMwh: 32.4,
  mw: 20,
  phs: 1000,
  lease: { rateUsdPerMwh: 95, includesPower: false, overheadUsdPerMwh: 8 },
  current: "mine",
};
const northRidge: DecisionInput = {
  hashpriceUsdPerPhDay: 38.5,
  powerPriceUsdPerMwh: 74.1,
  mw: 12,
  phs: 480,
  lease: { rateUsdPerMwh: 70, includesPower: false, overheadUsdPerMwh: 8 },
};
const tariff: DecisionInput = {
  hashpriceUsdPerPhDay: 38.5,
  powerPriceUsdPerMwh: 40,
  mw: 0.015,
  phs: 0.3945, // 26.3 PH/s на МВт, как в docs/screens.md
  current: "mine",
};

describe("примеры из docs/screens.md", () => {
  it("Houston Hub → Lease to AI, +$136/h", () => {
    const r = ok(houston);
    expect(r.phsPerMw).toBeCloseTo(50, 9);
    expect(r.miningRevenue).toBeCloseTo(80.2, 1);
    expect(r.options.mine).toBeCloseTo(47.8, 1);
    expect(r.options.lease).toBeCloseTo(54.6, 9);
    expect(r.options.off).toBe(0);
    expect(r.chosen).toBe("lease");
    expect(r.keepAsIs).toBe(false);
    expect(r.changed).toBe(true);
    expect(Math.round(r.gainVsMiningPerHour)).toBe(136);
    expect(r.marginToNext).toBeCloseTo(6.8, 1);
  });

  it("North Ridge → Switch off, экономия $119/h", () => {
    const r = ok(northRidge);
    expect(r.phsPerMw).toBeCloseTo(40, 9);
    expect(r.miningRevenue).toBeCloseTo(64.17, 2);
    expect(r.options.mine).toBeCloseTo(-9.93, 2);
    expect(r.options.lease).toBeCloseTo(-12.1, 9);
    expect(r.chosen).toBe("off");
    expect(r.keepAsIs).toBe(false);
    expect(Math.round(r.gainVsMiningPerHour)).toBe(119);
  });

  it("My tariff → Mine · keep as is, ≈ $0.03/h", () => {
    const r = ok(tariff);
    expect(r.phsPerMw).toBeCloseTo(26.3, 9);
    expect(r.options.lease).toBeNull();
    expect(r.options.mine).toBeGreaterThan(2);
    expect(r.options.mine).toBeLessThan(2.5);
    expect(r.chosen).toBe("mine");
    expect(r.keepAsIs).toBe(true);
    expect(r.marginToNext).toBeLessThan(5);
    expect(r.profitPerHour).toBeCloseTo(0.03, 2);
  });
});

describe("keep as is", () => {
  it("близкая аренда не перебивает текущий Mine (46.00 против 47.80)", () => {
    // Lease = 95 − 32.4 − 8 = 54.6; снижаем ставку, чтобы получить +46.00.
    const r = ok({ ...houston, lease: { rateUsdPerMwh: 86.4, includesPower: false, overheadUsdPerMwh: 8 } });
    expect(r.options.lease).toBeCloseTo(46, 9);
    expect(r.best).toBe("mine");
    expect(r.chosen).toBe("mine");
    expect(r.keepAsIs).toBe(true);
    expect(r.changed).toBe(false);
  });

  it("лучший вариант опережает текущий меньше порога → остаёмся на текущем", () => {
    const r = ok({ ...houston, current: "mine", lease: { rateUsdPerMwh: 90, includesPower: false, overheadUsdPerMwh: 8 } });
    // lease = 49.6, mine ≈ 47.81: разница < 5
    expect(r.best).toBe("lease");
    expect(r.chosen).toBe("mine");
    expect(r.keepAsIs).toBe(true);
    expect(r.gainVsMiningPerHour).toBeCloseTo(0, 9);
  });

  it("разница ровно равна порогу → переключаемся", () => {
    const r = ok({
      hashpriceUsdPerPhDay: 24,
      powerPriceUsdPerMwh: 0,
      mw: 1,
      phs: 1, // mine = 1
      lease: { rateUsdPerMwh: 6, includesPower: false, overheadUsdPerMwh: 0 },
      current: "mine",
    });
    expect(r.options.mine).toBeCloseTo(1, 9);
    expect(r.options.lease).toBeCloseTo(6, 9);
    expect(r.chosen).toBe("lease");
    expect(r.keepAsIs).toBe(false);
  });

  it("свой порог: при threshold=10 Houston остаётся на Mine", () => {
    const r = ok({ ...houston, thresholdUsdPerMwh: 10 });
    expect(r.chosen).toBe("mine");
    expect(r.keepAsIs).toBe(true);
  });

  it("без текущего решения близкий отрыв помечается keep as is, но выбирается лучший", () => {
    const r = ok({ ...tariff, current: null });
    expect(r.chosen).toBe("mine");
    expect(r.keepAsIs).toBe(true);
    expect(r.changed).toBe(false);
  });
});

describe("крайние случаи", () => {
  it("ставка «за всё» — электричество не вычитается", () => {
    const r = ok({ ...houston, lease: { rateUsdPerMwh: 95, includesPower: true, overheadUsdPerMwh: 8 } });
    expect(r.options.lease).toBe(87);
    // и не зависит от цены электричества
    const r2 = ok({ ...houston, powerPriceUsdPerMwh: 500, lease: { rateUsdPerMwh: 95, includesPower: true, overheadUsdPerMwh: 8 } });
    expect(r2.options.lease).toBe(87);
    expect(r2.chosen).toBe("lease");
  });

  it("отрицательная цена электричества увеличивает доход от майнинга и аренды", () => {
    const r = ok({ ...houston, powerPriceUsdPerMwh: -20, current: null });
    expect(r.options.mine).toBeCloseTo(100.21, 1);
    expect(r.options.lease).toBeCloseTo(107, 9);
    expect(r.chosen).toBe("lease");
  });

  it("отрицательная цена и отрицательная аренда без электричества: выбирается майнинг", () => {
    const r = ok({
      hashpriceUsdPerPhDay: 60,
      powerPriceUsdPerMwh: -50,
      mw: 10,
      phs: 500,
      lease: { rateUsdPerMwh: 40, includesPower: true, overheadUsdPerMwh: 8 },
    });
    expect(r.chosen).toBe("mine");
  });

  it("оплата за снижение нагрузки делает Switch off выгоднее", () => {
    const r = ok({ ...northRidge, curtailmentUsdPerMwh: 12 });
    expect(r.options.off).toBe(12);
    expect(r.chosen).toBe("off");
    expect(r.gainVsMiningPerHour).toBeCloseTo((12 + 9.9333) * 12, 2);
  });

  it("равенство значений: без текущего — по порядку Mine → Lease → Off", () => {
    // mine = 0 − 0 = 0 = off
    const r = ok({ hashpriceUsdPerPhDay: 0, powerPriceUsdPerMwh: 0, mw: 1, phs: 1 });
    expect(r.options.mine).toBe(0);
    expect(r.chosen).toBe("mine");
  });

  it("равенство значений: текущее решение сохраняется", () => {
    const base = { hashpriceUsdPerPhDay: 0, powerPriceUsdPerMwh: 0, mw: 1, phs: 1, thresholdUsdPerMwh: 0 };
    expect(ok({ ...base, current: "off" }).chosen).toBe("off");
    expect(ok({ ...base, current: "off" }).changed).toBe(false);
  });

  it("без ставки аренды вариант Lease недоступен, даже если текущее решение — lease", () => {
    const r = ok({ ...tariff, current: "lease" });
    expect(r.options.lease).toBeNull();
    expect(r.chosen).not.toBe("lease");
  });

  it("нулевая мощность — ошибка", () => {
    const r = decide({ ...houston, mw: 0 });
    expect(r).toEqual({ ok: false, errors: ["Power draw must be greater than 0"] });
  });

  it("некорректный ввод: NaN, Infinity, отрицательные значения", () => {
    const r = decide({
      hashpriceUsdPerPhDay: -1,
      powerPriceUsdPerMwh: Number.NaN,
      mw: -5,
      phs: Number.POSITIVE_INFINITY,
      thresholdUsdPerMwh: -2,
      lease: { rateUsdPerMwh: -1, includesPower: false, overheadUsdPerMwh: Number.NaN },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(7);
  });

  it("нулевой хешрейт — ошибка", () => {
    expect(decide({ ...houston, phs: 0 }).ok).toBe(false);
  });
});
