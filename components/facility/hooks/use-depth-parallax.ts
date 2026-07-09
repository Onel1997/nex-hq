"use client";

import { DEPTH_PARALLAX_FACTOR } from "@/lib/facility/layout";
import type { FacilityDepthLayer } from "@/lib/facility/types";
import { useCallback, useEffect, useState } from "react";

export interface DepthParallaxOffset {
  x: number;
  y: number;
}

/**
 * Subtle pointer-driven parallax — distant chambers drift less than foreground labs.
 */
export function useDepthParallax(enabled: boolean): DepthParallaxOffset {
  const [offset, setOffset] = useState<DepthParallaxOffset>({ x: 0, y: 0 });

  const onMove = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;
      const nx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ny = (event.clientY / window.innerHeight - 0.5) * 2;
      setOffset({ x: nx, y: ny });
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [enabled, onMove]);

  return offset;
}

export function depthParallaxTranslate(
  depth: FacilityDepthLayer,
  offset: DepthParallaxOffset,
): string {
  const factor = DEPTH_PARALLAX_FACTOR[depth];
  const x = offset.x * factor;
  const y = offset.y * factor * 0.72;
  return `${x.toFixed(2)}px, ${y.toFixed(2)}px`;
}
