"use client";

import { useCallback, useEffect, useState } from "react";
import { loadMarks, saveMarks, withMarks, type MarkMap } from "@/lib/marks";
import type { Mark } from "@/lib/types";

/** Operator marks from localStorage; updated immediately and persisted. */
export function useMarks() {
  const [marks, setMarks] = useState<MarkMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMarks(loadMarks(window.localStorage));
    setReady(true);
  }, []);

  const change = useCallback((changes: Record<string, Mark | null>) => {
    setMarks((prev) => {
      const next = withMarks(prev, changes);
      saveMarks(window.localStorage, next);
      return next;
    });
  }, []);

  return { marks, ready, change };
}
