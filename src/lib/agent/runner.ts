// Сборка зависимостей цикла для режима: live (Telegraph + публичные источники, площадки из data/sites.json)
// или mock (выдуманные цифры, без сети и денег).

import { mockAgentSnapshot, mockSeedSites, type MockState } from "../data/mock";
import { getFreshSnapshot, getLiveSnapshot } from "../live/market";
import { readSites } from "../live/sites";
import { dailyLimitUsd, readLedger, spentTodayUsd } from "../live/telegraph";
import { createTelegramNotifier } from "../bot/notify";
import { publicAppUrl } from "../bot/messages";
import { runCycle, type CycleDeps, type CycleResult } from "./cycle";
import { agentDir, createFileStore } from "./store";
import type { AgentMode } from "./types";

export interface RunnerOptions {
  mode: AgentMode;
  /** Только mock: сымитировать сбой (provider-error, error, limit). */
  state?: MockState;
  log?: (line: string) => void;
  /** Папка data/ (для тестов). */
  dataRoot?: string;
  /** Только live: не брать снимок из кэша, а купить новый (проверка лимита и сбоев). */
  fresh?: boolean;
}

/**
 * Токен бота Hash or Lease. Имя переменной своё, а не TELEGRAM_BOT_TOKEN / BOT_TOKEN: такие часто уже есть
 * в окружении машины от других ботов, и приложение не должно молча взять чужой токен.
 */
export const BOT_TOKEN_VAR = "HASHORLEASE_BOT_TOKEN";

export function botToken(): string | null {
  return process.env[BOT_TOKEN_VAR]?.trim() || null;
}

export function createDeps(opts: RunnerOptions): CycleDeps {
  const log = opts.log ?? (() => {});
  const store = createFileStore(agentDir(opts.mode, opts.dataRoot));
  const token = botToken();
  const common = {
    mode: opts.mode,
    store,
    log,
    appUrl: publicAppUrl(process.env.APP_URL),
    notify: token ? createTelegramNotifier(token, undefined, log) : undefined,
  };
  if (opts.mode === "live") {
    return {
      ...common,
      loadSites: () => readSites(),
      getSnapshot: () => (opts.fresh ? getLiveSnapshot(true) : getFreshSnapshot()),
      spend: () => ({ spentUsd: spentTodayUsd(), limitUsd: dailyLimitUsd(), paidRequests: readLedger().filter((r) => r.tx).length }),
    };
  }
  const state = opts.state ?? "default";
  return {
    ...common,
    loadSites: () => mockSeedSites(),
    getSnapshot: async () => mockAgentSnapshot(state, new Date()),
    // В mock денег нет: платных запросов не бывает, лимит выдуманный.
    spend: () => ({ spentUsd: state === "limit" ? 1 : 0, limitUsd: 1, paidRequests: 0 }),
  };
}

export function runOnce(opts: RunnerOptions): Promise<CycleResult> {
  return runCycle(createDeps(opts));
}
