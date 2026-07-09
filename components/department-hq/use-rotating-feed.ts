"use client";

import { useEffect, useState } from "react";
import type { DepartmentHqFeedItem } from "./types";

export function useRotatingFeed(
  items: DepartmentHqFeedItem[],
  intervalMs = 4200,
) {
  const [visible, setVisible] = useState<DepartmentHqFeedItem[]>([]);

  useEffect(() => {
    if (items.length === 0) {
      setVisible([]);
      return;
    }

    setVisible(items.slice(0, 5));

    let index = 5;
    const timer = setInterval(() => {
      setVisible((current) => {
        const nextItem = items[index % items.length]!;
        index += 1;
        return [nextItem, ...current].slice(0, 5);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [items, intervalMs]);

  return visible;
}
