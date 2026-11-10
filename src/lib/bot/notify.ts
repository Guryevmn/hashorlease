// Отправка оповещений агента подписчикам бота через Telegram Bot API (grammY). Без токена не создаётся.

import { Api, InlineKeyboard } from "grammy";
import { isSnoozed, readChats, CHATS_FILE } from "./chats";
import type { BotMessage, Button } from "./messages";

export function keyboardOf(buttons: Button[]): InlineKeyboard | undefined {
  if (buttons.length === 0) return undefined;
  const kb = new InlineKeyboard();
  for (const b of buttons) {
    if (b.url) kb.url(b.text, b.url);
    else if (b.data) kb.text(b.text, b.data);
  }
  return kb;
}

export function createTelegramNotifier(token: string, chatsFile = CHATS_FILE, log: (s: string) => void = () => {}) {
  const api = new Api(token);
  return async (messages: BotMessage[]): Promise<number> => {
    const chats = readChats(chatsFile);
    const now = new Date();
    let sent = 0;
    for (const [chatId, chat] of Object.entries(chats)) {
      for (const m of messages) {
        if ((m.kind === "change" || m.kind === "provider") && isSnoozed(chat, m.siteId, now)) continue;
        try {
          await api.sendMessage(chatId, m.text, { reply_markup: keyboardOf(m.buttons) });
          sent++;
        } catch (e) {
          log(`telegram: can't send to chat ${chatId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    return sent;
  };
}
