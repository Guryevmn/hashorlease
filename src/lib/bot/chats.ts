// Подписчики бота (data/bot-chats.json, не в git): кто написал /start, и «Snooze 1h» по площадкам.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface ChatState {
  subscribedAt: string;
  /** id площадки → до какого времени (ISO) не присылать оповещения. */
  snooze: Record<string, string>;
}

export type Chats = Record<string, ChatState>;

export const CHATS_FILE = join(process.cwd(), "data", "bot-chats.json");

export function readChats(file = CHATS_FILE): Chats {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Chats) : {};
  } catch {
    return {};
  }
}

export function writeChats(chats: Chats, file = CHATS_FILE): void {
  if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(chats, null, 2));
  renameSync(`${file}.tmp`, file);
}

export function subscribe(chats: Chats, chatId: string, now: Date): Chats {
  return { ...chats, [chatId]: chats[chatId] ?? { subscribedAt: now.toISOString(), snooze: {} } };
}

export function unsubscribe(chats: Chats, chatId: string): Chats {
  const next = { ...chats };
  delete next[chatId];
  return next;
}

export function snooze(chats: Chats, chatId: string, siteId: string, until: Date): Chats {
  // Старая кнопка «Snooze» в отписанном чате не включает оповещения снова.
  const c = chats[chatId];
  if (!c) return chats;
  return { ...chats, [chatId]: { ...c, snooze: { ...c.snooze, [siteId]: until.toISOString() } } };
}

export function isSnoozed(chat: ChatState, siteId: string | undefined, now: Date): boolean {
  if (!siteId) return false;
  const until = chat.snooze[siteId];
  return !!until && new Date(until).getTime() > now.getTime();
}
