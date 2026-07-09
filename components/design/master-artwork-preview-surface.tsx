"use client";

import {
  resolveCanvasBackgroundClass,
  resolveCanvasBackgroundStyle,
  type CanvasBackgroundId,
} from "@/lib/design/master-artwork-canvas-background";
import { cn } from "@/lib/utils";

/**
 * Preview-only surface — like Photoshop transparent canvas / Figma frame background.
 * The background layer is visual only and never modifies or regenerates artwork.
 */
interface MasterArtworkPreviewSurfaceProps {
  canvasBackground: CanvasBackgroundId;
  mockupMode?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function MasterArtworkPreviewSurface({
  canvasBackground,
  mockupMode = false,
  className,
  children,
}: MasterArtworkPreviewSurfaceProps) {
  return (
    <div className={cn("ma-preview-surface", mockupMode && "is-mockup-mode", className)}>
      {!mockupMode ? (
        <div
          className={cn("ma-canvas-bg-layer", resolveCanvasBackgroundClass(canvasBackground))}
          style={resolveCanvasBackgroundStyle(canvasBackground)}
          aria-hidden
        />
      ) : (
        <div className="ma-canvas-bg-layer ma-canvas-bg-layer--mockup" aria-hidden />
      )}
      <div className="ma-artwork-layer">{children}</div>
    </div>
  );
}
