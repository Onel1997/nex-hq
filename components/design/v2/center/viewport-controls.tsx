"use client";

import { cn } from "@/lib/utils";
import { Expand, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";

type ZoomMode = "fit" | number;

interface ViewportControlsProps {
  zoom: ZoomMode;
  onZoomChange: (zoom: ZoomMode) => void;
  onFit: () => void;
  onFullscreen: () => void;
  fitScale: number;
  className?: string;
}

export function ViewportControls({
  zoom,
  onZoomChange,
  onFit,
  onFullscreen,
  fitScale,
  className,
}: ViewportControlsProps) {
  const displayZoom =
    zoom === "fit" ? `${Math.round(fitScale * 100)}%` : `${Math.round(zoom * 100)}%`;

  const zoomIn = () => {
    const current = zoom === "fit" ? fitScale : zoom;
    onZoomChange(Math.min(4, current + 0.25));
  };

  const zoomOut = () => {
    const current = zoom === "fit" ? fitScale : zoom;
    onZoomChange(Math.max(0.1, current - 0.25));
  };

  return (
    <div className={cn("dsv2-viewport-controls", className)}>
      <button type="button" className="dsv2-viewport-btn" onClick={zoomOut} aria-label="Zoom out">
        <Minus className="size-3.5" />
      </button>
      <button type="button" className="dsv2-viewport-btn dsv2-viewport-zoom" onClick={onFit}>
        {displayZoom}
      </button>
      <button type="button" className="dsv2-viewport-btn" onClick={zoomIn} aria-label="Zoom in">
        <Plus className="size-3.5" />
      </button>
      <span className="dsv2-viewport-divider" />
      <button type="button" className="dsv2-viewport-btn" onClick={onFit} title="Fit to view">
        <Expand className="size-3.5" />
        <span>Fit</span>
      </button>
      <button
        type="button"
        className="dsv2-viewport-btn"
        onClick={() => onZoomChange(1)}
        title="Actual size"
      >
        100%
      </button>
      <button
        type="button"
        className="dsv2-viewport-btn"
        onClick={onFullscreen}
        title="Fullscreen"
      >
        <Maximize2 className="size-3.5" />
      </button>
      <button
        type="button"
        className="dsv2-viewport-btn"
        onClick={onFit}
        title="Reset view"
        aria-label="Reset view"
      >
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  );
}
