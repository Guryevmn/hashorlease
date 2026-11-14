// Пересчёт чисел для публичных постов: часы работы агента, серия, платные запросы, расход.
// Запуск: node scripts/recount.mjs [КОНЕЦ_UTC]   например: node scripts/recount.mjs 2026-11-20T12:00:00Z
// Только чтение data/agent/live/runs.jsonl и data/ledger.jsonl. Ключей не читает и не печатает.
import fs from "node:fs";

const START = "2026-11-10T18:00:00.000Z"; // первый часовой слот постоянной работы агента
const HOUR = 3600_000;
const read = (f) => fs.readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const runs = read("data/agent/live/runs.jsonl").filter((r) => r.mode === "live");
const ledger = read("data/ledger.jsonl");

const end = process.argv[2] ? new Date(process.argv[2]) : new Date();
const lastSlot = Math.floor(end.getTime() / HOUR) * HOUR - HOUR; // последний полностью прошедший слот
const slots = [];
for (let t = Date.parse(START); t <= lastSlot; t += HOUR) slots.push(t);

// слот «с решением»: в нём был успешный цикл с решением по площадкам; «с покупкой»: цикл ещё и заплатил в этот час
const okSlots = new Set(runs.filter((r) => r.ok && r.decided > 0).map((r) => Date.parse(r.hour)));
const bought = new Set(runs.filter((r) => r.ok && r.paidRequests > 0).map((r) => Date.parse(r.hour)));

const missing = slots.filter((t) => !okSlots.has(t));
let best = 0, bestEnd = null, cur = 0;
for (const t of slots) {
  cur = okSlots.has(t) ? cur + 1 : 0;
  if (cur > best) { best = cur; bestEnd = t; }
}
const lastGap = missing.at(-1);
const current = lastGap === undefined ? slots.length : slots.filter((t) => t > lastGap).length;
const iso = (t) => new Date(t).toISOString().slice(0, 16) + "Z";

const paid = ledger.filter((l) => l.status === 200 && l.tx);
const sum = paid.reduce((s, l) => s + l.cost_usd, 0);
const byDay = {};
for (const l of paid) { const d = l.at.slice(0, 10); byDay[d] = (byDay[d] ?? 0) + 1; }

console.log(`Пересчёт на ${end.toISOString().slice(0, 16)}Z (последний закрытый слот ${iso(lastSlot)})`);
console.log(`Слотов с ${iso(Date.parse(START))}: ${slots.length}; с решением: ${slots.filter((t) => okSlots.has(t)).length}; с покупкой: ${slots.filter((t) => bought.has(t)).length}`);
console.log(`Пропуски: ${missing.length ? missing.map(iso).join(", ") : "нет"}`);
console.log(`Самая длинная серия: ${best} ч (до ${bestEnd ? iso(bestEnd) : "-"}); текущая серия: ${current} ч`);
console.log(`Платных запросов всего: ${paid.length} на $${sum.toFixed(2)}; по дням: ${JSON.stringify(byDay)}`);
console.log(`Записей в журнале: ${ledger.length}`);
