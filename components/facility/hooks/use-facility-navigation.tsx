"use client";

import type { AgentId } from "@/lib/constants/agents";
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

/** Camera transform targets per navigation mode — future fly-to animation hooks here. */
export function navigationTransform(
  mode: FacilityNavMode,
  focusTarget: AgentId | null,
): { scale: number; x: number; y: number } {
  if (mode === "overview" || !focusTarget) {
    return { scale: 1, x: 0, y: 0 };
  }

  if (focusTarget === "ceo") {
    return { scale: 1.08, x: 0, y: 4 };
  }

  const labOffsets: Partial<Record<AgentId, { x: number; y: number }>> = {
    research: { x: 8, y: 2 },
    designer: { x: 6, y: -6 },
    marketing: { x: -8, y: 2 },
    content: { x: 4, y: -8 },
    image: { x: -6, y: 0 },
    shopify: { x: -4, y: -6 },
  };

  const offset = labOffsets[focusTarget] ?? { x: 0, y: 0 };
  return { scale: 1.12, x: offset.x, y: offset.y };
}
