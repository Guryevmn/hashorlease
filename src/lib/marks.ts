// Отметки оператора «что я сделал в этот час». Хранятся в браузере (localStorage), как и площадки.

import type { Decision } from "./decision";
import type { Mark } from "./types";

export type MarkMap = Record<string, Mark>;

export const MARKS_KEY = "hol.marks.v1";

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const markKey = (siteId: string, hour: string) => `${siteId}|${hour}`;

const DECISIONS: Decision[] = ["mine", "lease", "off"];

function isMark(m: unknown): m is Mark {
  if (!m || typeof m !== "object") return false;
  const x = m as { kind?: unknown; actual?: unknown };
  if (x.kind === "followed" || x.kind === "skip") return true;
  return x.kind === "other" && DECISIONS.includes(x.actual as Decision);
}

export function loadMarks(storage: Store | null | undefined): MarkMap {
  const raw = storage?.getItem(MARKS_KEY);
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(data).filter(([, m]) => isMark(m))) as MarkMap;
  } catch {
    return {};
  }
}

export function saveMarks(storage: Store | null | undefined, marks: MarkMap): void {
  storage?.setItem(MARKS_KEY, JSON.stringify(marks));
}

/** Новая карта с отметкой (null — снять отметку). Исходную не меняет. */
export function withMarks(marks: MarkMap, changes: Record<string, Mark | null>): MarkMap {
  const next = { ...marks };
  for (const [k, m] of Object.entries(changes)) {
    if (m) next[k] = m;
    else delete next[k];
  }
  return next;
}
