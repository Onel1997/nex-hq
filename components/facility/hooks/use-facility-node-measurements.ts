"use client";

import { FACILITY_CONDUIT_NODES } from "@/lib/facility/graph";
import {
  rectToSvgFrame,
  type MeasuredSceneGeometry,
} from "@/lib/facility/measured-conduits";
import type { FacilitySceneNodeId } from "@/lib/facility/types";
import { useEffect, useState, type RefObject } from "react";

export function useFacilityNodeMeasurements(
  canvasRef: RefObject<HTMLDivElement | null>,
  canvasSize: { width: number; height: number },
  active: boolean,
): MeasuredSceneGeometry | null {
  const [geometry, setGeometry] = useState<MeasuredSceneGeometry | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || canvasSize.width <= 0 || canvasSize.height <= 0) {
      setGeometry(null);
      return;
    }

    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect();
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

      const nexusEl = canvas.querySelector('[data-facility-nexus="chamber"]');
      if (!nexusEl) return;

      const brainNexus = rectToSvgFrame(
        "brain",
        nexusEl.getBoundingClientRect(),
        canvasRect,
      );

      const nodes: MeasuredSceneGeometry["nodes"] = {};
      let found = 0;

      for (const nodeId of FACILITY_CONDUIT_NODES) {
        const el = canvas.querySelector(
          `[data-facility-node="${nodeId}"]`,
        ) as HTMLElement | null;
        if (!el) continue;
        nodes[nodeId] = rectToSvgFrame(
          nodeId as FacilitySceneNodeId,
          el.getBoundingClientRect(),
          canvasRect,
        );
        found += 1;
      }

      setGeometry({
        brainNexus,
        nodes,
        ready: found === FACILITY_CONDUIT_NODES.length,
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);

    let raf = 0;
    const tick = () => {
      measure();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [canvasRef, canvasSize.width, canvasSize.height, active]);

  return geometry;
}
