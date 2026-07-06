"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

type ZoomMode = "fit" | number;

interface UseMasterArtworkViewportOptions {
  viewportRef: RefObject<HTMLDivElement | null>;
  artboardRef: RefObject<HTMLDivElement | null>;
  hasPreview: boolean;
  isGenerating: boolean;
  previewKey: string | number;
  focusMode?: boolean;
  zoom: ZoomMode;
  setZoom: (value: ZoomMode | ((current: ZoomMode) => ZoomMode)) => void;
  fitScale: number;
  setFitScale: (value: number) => void;
}

export function useMasterArtworkViewport({
  viewportRef,
  artboardRef,
  hasPreview,
  isGenerating,
  previewKey,
  focusMode = false,
  zoom,
  fitScale,
  setZoom,
  setFitScale,
}: UseMasterArtworkViewportOptions) {
  const lastPreviewKeyRef = useRef<string | number | null>(null);

  const resetViewport = useCallback(() => {
    setZoom("fit");
    setFitScale(1);

    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
    viewport.style.transform = "";
  }, [setFitScale, setZoom, viewportRef]);

  const recomputeFit = useCallback(() => {
    const viewport = viewportRef.current;
    const artboard = artboardRef.current;
    if (!viewport || !artboard || !hasPreview) {
      setFitScale(1);
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const artboardWidth = artboard.offsetWidth;
    const artboardHeight = artboard.offsetHeight;
    if (viewportRect.width <= 0 || viewportRect.height <= 0) return;
    if (artboardWidth <= 0 || artboardHeight <= 0) return;

    const padding = focusMode ? 12 : 20;
    const availableW = viewportRect.width - padding * 2;
    const availableH = viewportRect.height - padding * 2;
    const scaleW = availableW / artboardWidth;
    const scaleH = availableH / artboardHeight;
    const next = Math.min(scaleW, scaleH, 1.25);
    setFitScale(Math.max(0.35, next));
  }, [artboardRef, focusMode, hasPreview, setFitScale, viewportRef]);

  useEffect(() => {
    recomputeFit();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => recomputeFit());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [hasPreview, previewKey, focusMode, recomputeFit, viewportRef]);

  useEffect(() => {
    if (isGenerating) return;
    if (!hasPreview) return;
    if (lastPreviewKeyRef.current === previewKey) return;

    lastPreviewKeyRef.current = previewKey;
    resetViewport();
    window.requestAnimationFrame(() => {
      recomputeFit();
    });
  }, [hasPreview, isGenerating, previewKey, recomputeFit, resetViewport]);

  const zoomScale = zoom === "fit" ? fitScale : zoom;

  return {
    zoomScale,
    resetViewport,
    recomputeFit,
  };
}
