"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nexhq-facility-command-history";
const MAX_ENTRIES = 10;

export interface CommandHistoryEntry {
  id: string;
  goal: string;
  submittedAt: string;
  parentTaskId?: string;
}

function loadHistory(): CommandHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommandHistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function useCommandHistory() {
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const addEntry = useCallback((goal: string, parentTaskId?: string) => {
    const entry: CommandHistoryEntry = {
      id: crypto.randomUUID(),
      goal,
      submittedAt: new Date().toISOString(),
      parentTaskId,
    };
    setHistory((prev) => {
      const next = [
        entry,
        ...prev.filter((item) => item.goal !== goal),
      ].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { history, addEntry };
}
