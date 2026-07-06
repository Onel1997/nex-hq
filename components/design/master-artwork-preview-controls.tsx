"use client";

import {
  CANVAS_BACKGROUND_OPTIONS,
  DEFAULT_CANVAS_BACKGROUND,
  DEFAULT_MOCKUP_GARMENT,
  MOCKUP_GARMENT_OPTIONS,
  type CanvasBackgroundId,
  type MockupGarmentId,
} from "@/lib/design/master-artwork-canvas-background";
import { cn } from "@/lib/utils";
import { Shirt } from "lucide-react";

interface MasterArtworkPreviewControlsProps {
  canvasBackground: CanvasBackgroundId;
  onCanvasBackgroundChange: (background: CanvasBackgroundId) => void;
  mockupMode: boolean;
  onMockupModeChange: (active: boolean) => void;
  mockupGarment: MockupGarmentId;
  onMockupGarmentChange: (garment: MockupGarmentId) => void;
  hasArtwork?: boolean;
  compact?: boolean;
}

export function MasterArtworkTransparentBadge() {
  return (
    <span className="ma-transparent-badge" title="Print file contains no background">
      Transparent Artwork ✓
    </span>
  );
}

export function MasterArtworkPreviewControls({
  canvasBackground,
  onCanvasBackgroundChange,
  mockupMode,
  onMockupModeChange,
  mockupGarment,
  onMockupGarmentChange,
  hasArtwork = false,
  compact = false,
}: MasterArtworkPreviewControlsProps) {
  return (
    <div className={cn("ma-preview-controls", compact && "is-compact")}>
      <MasterArtworkTransparentBadge />

      {!mockupMode ? (
        <div className="ma-canvas-bg-selector" role="group" aria-label="Canvas background preview">
          <span className="ma-canvas-bg-label">Preview Only</span>
          <div className="ma-canvas-bg-swatches">
            {CANVAS_BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "ma-canvas-bg-swatch",
                  option.id === "transparent" && "is-transparent",
                  canvasBackground === option.id && "is-active",
                )}
                style={option.color ? { backgroundColor: option.color } : undefined}
                onClick={() => onCanvasBackgroundChange(option.id)}
                title={option.label}
                aria-label={option.label}
                aria-pressed={canvasBackground === option.id}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="ma-mockup-garment-selector" role="group" aria-label="Mockup garment">
          <span className="ma-canvas-bg-label">Garment</span>
          <div className="ma-mockup-garment-options">
            {MOCKUP_GARMENT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "ma-mockup-garment-btn",
                  mockupGarment === option.id && "is-active",
                )}
                onClick={() => onMockupGarmentChange(option.id)}
                aria-pressed={mockupGarment === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className={cn("ma-mockup-preview-btn", mockupMode && "is-active")}
        onClick={() => onMockupModeChange(!mockupMode)}
        disabled={!hasArtwork}
        title={hasArtwork ? "Preview artwork on apparel mockups" : "Generate artwork first"}
        aria-pressed={mockupMode}
      >
        <Shirt className="size-3.5" aria-hidden />
        Mockup Preview
      </button>
    </div>
  );
}

export {
  DEFAULT_CANVAS_BACKGROUND,
  DEFAULT_MOCKUP_GARMENT,
  type CanvasBackgroundId,
  type MockupGarmentId,
};
