"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { DataSource } from "@/lib/data/types";
import { createMockDataSource, parseMockState, type MockState } from "@/lib/data/mock";
import { createLiveDataSource } from "@/lib/data/live";

export const LIVE = process.env.NEXT_PUBLIC_DATA_MODE === "live";

interface Ctx {
  ds: DataSource;
  state: MockState;
  /** Real data (not demo / state preview). */
  live: boolean;
  /** Incremented when data needs to be re-read (after spending, Retry). */
  tick: number;
  bump: () => void;
}

const DataCtx = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const state = parseMockState(params.get("state"));
  const [tick, setTick] = useState(0);
  const ds = useMemo(() => {
    const storage = typeof window === "undefined" ? null : window.localStorage;
    return LIVE && state === "default" ? createLiveDataSource({ storage }) : createMockDataSource({ state, storage });
  }, [state]);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const live = LIVE && state === "default";
  const value = useMemo(() => ({ ds, state, live, tick, bump }), [ds, state, live, tick, bump]);
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData(): Ctx {
  const c = useContext(DataCtx);
  if (!c) throw new Error("useData outside DataProvider");
  return c;
}

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
}

/** Loads data from the source; re-read when the source changes or on bump(). */
export function useAsync<T>(load: (ds: DataSource) => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const { ds, tick, bump } = useData();
  const [s, setS] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  const loadRef = useRef(load);
  loadRef.current = load;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = JSON.stringify(deps);

  useEffect(() => {
    let alive = true;
    setS((p) => ({ ...p, loading: true, error: undefined }));
    loadRef.current(ds).then(
      (data) => alive && setS({ data, loading: false }),
      (error: unknown) => alive && setS({ error: error instanceof Error ? error : new Error(String(error)), loading: false }),
    );
    return () => {
      alive = false;
    };
  }, [ds, tick, key]);

  return { data: s.data, error: s.error, loading: s.loading, reload: bump };
}

/** Link that preserves ?state=… across screens. */
export function AppLink({ href, children, ...rest }: React.ComponentProps<typeof Link>) {
  const { state } = useData();
  const target = typeof href === "string" && state !== "default" ? `${href}${href.includes("?") ? "&" : "?"}state=${state}` : href;
  return (
    <Link href={target} {...rest}>
      {children}
    </Link>
  );
}

export function useIsActive(path: string): boolean {
  const pathname = usePathname();
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");
}

/** Appends ?state=… to the path for programmatic navigation. */
export function useWithState(): (path: string) => string {
  const { state } = useData();
  return (path) => (state === "default" ? path : `${path}${path.includes("?") ? "&" : "?"}state=${state}`);
}
