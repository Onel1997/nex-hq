"use client";

import { useCallback, useEffect, useState } from "react";

export function usePersistedSections<T extends Record<string, boolean>>(
  storageKey: string,
  defaults: T,
) {
  const [sections, setSectionsState] = useState<T>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<T>;
        setSectionsState((current) => ({ ...current, ...parsed }));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  const setSections = useCallback(
    (value: T | ((prev: T) => T)) => {
      setSectionsState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey],
  );

  const toggleSection = useCallback(
    (sectionId: keyof T & string) => {
      setSections((prev) => ({
        ...prev,
        [sectionId]: !prev[sectionId],
      }));
    },
    [setSections],
  );

  const expandSection = useCallback(
    (sectionId: keyof T & string) => {
      setSections((prev) =>
        prev[sectionId] ? prev : { ...prev, [sectionId]: true },
      );
    },
    [setSections],
  );

  return { sections, setSections, toggleSection, expandSection, hydrated };
}
