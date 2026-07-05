"use client";

import {
  getMockModeActive,
  refreshMockModeState,
  startMockModeProbeLoop,
  subscribeMockMode,
} from "@/lib/design/studio-mock-mode";
import { useCallback, useEffect, useState } from "react";

export function useStudioMockMode() {
  const [mockMode, setMockMode] = useState(false);
  const [probing, setProbing] = useState(true);

  useEffect(() => {
    setMockMode(getMockModeActive());
    const unsubscribe = subscribeMockMode(setMockMode);
    const stopProbe = startMockModeProbeLoop();
    setProbing(false);

    return () => {
      unsubscribe();
      stopProbe();
    };
  }, []);

  const recheck = useCallback(async () => {
    setProbing(true);
    try {
      await refreshMockModeState();
    } finally {
      setProbing(false);
    }
  }, []);

  return { mockMode, probing, recheck };
}
