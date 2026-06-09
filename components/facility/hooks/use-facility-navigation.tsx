"use client";

import type { AgentId } from "@/lib/constants/agents";
import { FACILITY_HERO_SCALE } from "@/lib/facility/layout";
import type { FacilityNavigationState, FacilityNavMode } from "@/lib/facility/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface FacilityNavigationContextValue {
  navigation: FacilityNavigationState;
  navigateToLab: (agentId: AgentId) => void;
  navigateToCeo: () => void;
  navigateToOverview: () => void;
}

const FacilityNavigationContext =
  createContext<FacilityNavigationContextValue | null>(null);

const OVERVIEW: FacilityNavigationState = {
  mode: "overview",
  focusTarget: null,
};

export function FacilityNavigationProvider({
  children,
  onLabFocus,
}: {
  children: ReactNode;
  onLabFocus?: (agentId: AgentId) => void;
}) {
  const [navigation, setNavigation] =
    useState<FacilityNavigationState>(OVERVIEW);

  const navigateToLab = useCallback(
    (agentId: AgentId) => {
      setNavigation({ mode: "lab-focus", focusTarget: agentId });
      onLabFocus?.(agentId);
    },
    [onLabFocus],
  );

  const navigateToCeo = useCallback(() => {
    setNavigation({ mode: "ceo-focus", focusTarget: "ceo" });
    onLabFocus?.("ceo");
  }, [onLabFocus]);

  const navigateToOverview = useCallback(() => {
    setNavigation(OVERVIEW);
  }, []);

  const value = useMemo(
    () => ({
      navigation,
      navigateToLab,
      navigateToCeo,
      navigateToOverview,
    }),
    [navigation, navigateToLab, navigateToCeo, navigateToOverview],
  );

  return (
    <FacilityNavigationContext.Provider value={value}>
      {children}
    </FacilityNavigationContext.Provider>
  );
}

export function useFacilityNavigation(): FacilityNavigationContextValue {
  const ctx = useContext(FacilityNavigationContext);
  if (!ctx) {
    throw new Error(
      "useFacilityNavigation must be used within FacilityNavigationProvider",
    );
  }
  return ctx;
}

/** Camera transform targets per navigation mode — fly-to chamber foundation. */
export function navigationTransform(
  mode: FacilityNavMode,
  focusTarget: AgentId | null,
): {
  scale: number;
  x: number;
  y: number;
  rotateX: number;
  perspective: number;
} {
  if (mode === "overview" || !focusTarget) {
    return {
      scale: FACILITY_HERO_SCALE,
      x: 0,
      y: -2,
      rotateX: 0,
      perspective: 1200,
    };
  }

  if (focusTarget === "ceo") {
    return {
      scale: FACILITY_HERO_SCALE * 1.08,
      x: 0,
      y: 3,
      rotateX: 4,
      perspective: 1100,
    };
  }

  const labOffsets: Partial<Record<AgentId, { x: number; y: number }>> = {
    research: { x: 10, y: 6 },
    designer: { x: 9, y: -11 },
    content: { x: 4, y: -7 },
    marketing: { x: -10, y: 6 },
    image: { x: -3, y: 0 },
    shopify: { x: -8, y: -7 },
  };

  const offset = labOffsets[focusTarget] ?? { x: 0, y: 0 };
  return {
    scale: FACILITY_HERO_SCALE * 1.14,
    x: offset.x,
    y: offset.y,
    rotateX: 8,
    perspective: 1000,
  };
}
