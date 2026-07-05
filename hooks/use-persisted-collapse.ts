"use client";

import { useCallback, useEffect, useState } from "react";

export function usePersistedCollapse(storageKey: string, defaultCollapsed = false) {
  const [collapsed, setCollapsedState] = useState(defaultCollapsed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setCollapsedState(stored === "true");
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  const setCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setCollapsedState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey],
  );

  return { collapsed, setCollapsed, hydrated };
}
