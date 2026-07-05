"use client";

import { useEffect, useRef, useState } from "react";
import type { MasterArtworkStatusPhase } from "@/components/design/master-artwork-status";

const REVEAL_MS = 1400;
const GLOW_MS = 900;
const COMMERCIAL_MS = 1100;
const SUCCESS_MS = 1200;

export function useMasterArtworkReveal(revealToken: number, hasArtwork: boolean, isGenerating: boolean) {
  const [phase, setPhase] = useState<MasterArtworkStatusPhase>("idle");
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    if (isGenerating) {
      setPhase("idle");
      return;
    }

    if (!revealToken || !hasArtwork) {
      return;
    }

    setPhase("reveal");

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timersRef.current.push(id);
    };

    schedule(() => setPhase("glow"), REVEAL_MS);
    schedule(() => setPhase("commercial"), REVEAL_MS + GLOW_MS);
    schedule(() => setPhase("success"), REVEAL_MS + GLOW_MS + COMMERCIAL_MS);
    schedule(() => setPhase("idle"), REVEAL_MS + GLOW_MS + COMMERCIAL_MS + SUCCESS_MS);

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [revealToken, hasArtwork, isGenerating]);

  const isRevealing = phase === "reveal" || phase === "glow";
  const isGlowing = phase === "glow" || phase === "commercial";

  return { phase, isRevealing, isGlowing };
}
