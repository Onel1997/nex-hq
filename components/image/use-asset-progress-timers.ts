"use client";

import type { ImageStudioAsset } from "@/agents/image/types";
import { useEffect, useRef, useState } from "react";

export interface AssetElapsedTimer {
  elapsedMs: number;
  running: boolean;
}

type TimerRecord = {
  startedAt: number;
  elapsedMs: number;
  running: boolean;
};

function isAssetComplete(asset: ImageStudioAsset): boolean {
  return Boolean(asset.imageUrl) || asset.status === "completed" || asset.status === "ready";
}

function isAssetActive(
  asset: ImageStudioAsset,
  preparingAssetId: string | null,
  generatingAssetId: string | null,
): boolean {
  return (
    asset.id === preparingAssetId ||
    asset.id === generatingAssetId ||
    asset.status === "generating"
  );
}

export function formatAssetElapsedTime(ms: number | undefined): string {
  if (ms === undefined || ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** Per-asset elapsed timers — start on preparing/generating, stop on complete/failed. */
export function useAssetProgressTimers(
  assets: ImageStudioAsset[],
  preparingAssetId: string | null,
  generatingAssetId: string | null,
): Record<string, AssetElapsedTimer> {
  const timersRef = useRef<Map<string, TimerRecord>>(new Map());
  const [, setTick] = useState(0);

  useEffect(() => {
    const map = timersRef.current;
    const now = Date.now();

    for (const asset of assets) {
      const active = isAssetActive(asset, preparingAssetId, generatingAssetId);
      const complete = isAssetComplete(asset);
      const failed = asset.status === "failed";
      const record = map.get(asset.id);

      if (active) {
        if (!record?.running) {
          map.set(asset.id, { startedAt: now, elapsedMs: 0, running: true });
        }
        continue;
      }

      if ((complete || failed) && record?.running) {
        map.set(asset.id, {
          startedAt: record.startedAt,
          elapsedMs: now - record.startedAt,
          running: false,
        });
      }
    }

    const anyRunning = [...map.values()].some((record) => record.running);
    if (!anyRunning) return;

    const interval = setInterval(() => setTick((value) => value + 1), 250);
    return () => clearInterval(interval);
  }, [assets, preparingAssetId, generatingAssetId]);

  const now = Date.now();
  const timers: Record<string, AssetElapsedTimer> = {};

  for (const asset of assets) {
    const record = timersRef.current.get(asset.id);
    if (!record) continue;
    timers[asset.id] = {
      elapsedMs: record.running ? now - record.startedAt : record.elapsedMs,
      running: record.running,
    };
  }

  return timers;
}
