// Builds the cycle dependencies for a mode: live (Telegraph + public sources, sites from data/sites.json)
// or mock (made-up numbers, no network or money).

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
  /** The demo day has its own runner (src/lib/demo/day.ts). */
  mode: Exclude<AgentMode, "demo">;
  /** Mock only: simulate a failure (provider-error, error, limit). */
  state?: MockState;
  log?: (line: string) => void;
  /** The data/ folder (for tests). */
  dataRoot?: string;
  /** Live only: do not use the cached snapshot, buy a new one (to test the limit and failures). */
  fresh?: boolean;
}

/**
 * Hash or Lease bot token. The variable has its own name, not TELEGRAM_BOT_TOKEN / BOT_TOKEN: those often already exist
 * in the machine environment from other bots, and the app must not silently pick up someone else's token.
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
    // No money in mock: there are no paid requests, the limit is made up.
    spend: () => ({ spentUsd: state === "limit" ? 1 : 0, limitUsd: 1, paidRequests: 0 }),
  };
}

export function runOnce(opts: RunnerOptions): Promise<CycleResult> {
  return runCycle(createDeps(opts));
}
