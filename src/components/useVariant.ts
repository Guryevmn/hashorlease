"use client";

import { useEffect, useState } from "react";

/**
 * Design review switch: `?receipt=b` or `?pause=b` in the address shows the second variant of a screen.
 * Only for comparing variants on the review branch; the default is the recommended one.
 */
export function useVariant<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get(key) as T | null;
    if (q && allowed.includes(q)) setV(q);
  }, [key, allowed]);
  return v;
}
