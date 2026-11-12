// Hash or Lease Telegram bot (grammY): /start subscribes to alerts, /now shows the current decision, /stop unsubscribes.
// Decision-change alerts are sent by the hourly agent (npm run agent) to those who subscribed here.
// The bot makes no paid requests: /now reads the agent's latest entries from data/agent/<mode>/.
// /demo replays the simulated demo day (invented prices, every message marked as demo) into the chat that asked.
//
//   npm run bot        # needs HASHORLEASE_BOT_TOKEN in .env; the bot does not start without it

import { existsSync } from "node:fs";
import { Bot } from "grammy";
import { BOT_TOKEN_VAR, botToken } from "@/lib/agent/runner";
import { agentDir, createFileStore } from "@/lib/agent/store";
import type { AgentMode } from "@/lib/agent/types";
import { mockSeedSites } from "@/lib/data/mock";
import { readSites } from "@/lib/live/sites";
import { dailyLimitUsd, spentTodayUsd } from "@/lib/live/telegraph";
import { readChats, snooze, subscribe, unsubscribe, writeChats } from "@/lib/bot/chats";
import { demoDayReplay, nowReply, publicAppUrl, receiptsMessage, startMessage, type BotMessage } from "@/lib/bot/messages";
import { demoSiteLine, simulateDemoDay } from "@/lib/demo/day";
import { keyboardOf } from "@/lib/bot/notify";

if (existsSync(".env")) process.loadEnvFile(".env");

const token = botToken();
if (!token) {
  console.error(
    `Telegram bot is off: ${BOT_TOKEN_VAR} is not set in .env.\n` +
      `Create a bot with @BotFather, put its token into .env as ${BOT_TOKEN_VAR}=… and run npm run bot again.\n` +
      "The app and the hourly agent work without the bot.",
  );
  process.exit(1);
}

const mode: AgentMode = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "mock";
const store = createFileStore(agentDir(mode));
const appUrl = publicAppUrl(process.env.APP_URL);
const log = (s: string) => console.log(`[${new Date().toISOString().replace(/\.\d+Z$/, "Z")}] ${s}`);

const sites = () => (mode === "live" ? readSites() : mockSeedSites());
const spend = () => (mode === "live" ? { spentUsd: spentTodayUsd(), limitUsd: dailyLimitUsd() } : { spentUsd: 0, limitUsd: 1 });
const send = (m: BotMessage) => ({ text: m.text, opts: { reply_markup: keyboardOf(m.buttons) } });

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  writeChats(subscribe(readChats(), String(ctx.chat.id), new Date()));
  const m = send(startMessage(appUrl));
  await ctx.reply(m.text, m.opts);
});

bot.command("stop", async (ctx) => {
  writeChats(unsubscribe(readChats(), String(ctx.chat.id)));
  await ctx.reply("Alerts are off. Send /start to turn them back on.");
});

bot.command("now", async (ctx) => {
  const m = send(nowReply({ sites: sites(), decisions: store.readDecisions(), now: new Date(), ...spend(), query: ctx.match, appUrl }));
  await ctx.reply(m.text, m.opts);
});

bot.command("demo", async (ctx) => {
  // Computed in memory: nothing is bought and nothing is written to the agent's journal.
  const day = await simulateDemoDay({ appUrl });
  const replay = demoDayReplay({ siteName: day.site.name, siteLine: demoSiteLine(day.site), decisions: day.decisions, appUrl });
  for (const [i, message] of replay.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2500));
    const m = send(message);
    await ctx.reply(m.text, m.opts);
  }
});

bot.callbackQuery(/^snooze:(.+)$/, async (ctx) => {
  if (!ctx.chat) return void (await ctx.answerCallbackQuery());
  const chats = readChats();
  if (!chats[String(ctx.chat.id)]) return void (await ctx.answerCallbackQuery({ text: "Alerts are off here. Send /start first." }));
  writeChats(snooze(chats, String(ctx.chat.id), ctx.match[1], new Date(Date.now() + 3600_000)));
  await ctx.answerCallbackQuery({ text: "Snoozed for 1 hour" });
});

bot.callbackQuery(/^receipts:(.+)$/, async (ctx) => {
  const rows = store.readDecisions().filter((r) => r.siteId === ctx.match[1]);
  const last = rows[rows.length - 1];
  await ctx.answerCallbackQuery();
  if (!last) return void (await ctx.reply("No receipts yet for this site."));
  const m = send(receiptsMessage(last));
  await ctx.reply(m.text, m.opts);
});

bot.catch((err) => log(`bot error: ${err.message}`));

log(`Hash or Lease bot · mode ${mode} · reading agent history from data/agent/${mode}/`);
await bot.api.setMyCommands([
  { command: "now", description: "Current call for every site (or /now Houston)" },
  { command: "start", description: "Turn on alerts" },
  { command: "stop", description: "Turn off alerts" },
  { command: "demo", description: "Demo data: replay a simulated day where the call changes" },
]);
await bot.start({ onStart: (me) => log(`running as @${me.username}`) });
