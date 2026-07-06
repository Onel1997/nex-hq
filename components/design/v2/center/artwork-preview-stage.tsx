"use client";

import { MasterArtworkPreviewMedia } from "@/components/design/master-artwork-preview-media";
import { MasterArtworkPreviewSurface } from "@/components/design/master-artwork-preview-surface";
import type { ArtworkPreviewSource } from "@/components/design/v2/types";
import { ViewportControls } from "@/components/design/v2/center/viewport-controls";
import { ValidationStatusBadge } from "@/components/design/v2/inspector/validation-status";
import type { ValidationStatus } from "@/lib/design/artwork-validation";
import { useMasterArtworkViewport } from "@/hooks/use-master-artwork-viewport";
import { cn } from "@/lib/utils";
import { AlertCircle, FileImage } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface ArtworkPreviewStageProps {
  preview: ArtworkPreviewSource;
  fileName?: string;
  validationStatus?: ValidationStatus;
  uploadError?: string | null;
  onReplace?: () => void;
  className?: string;
}

type ZoomMode = "fit" | number;

export function ArtworkPreviewStage({
  preview,
  fileName,
  validationStatus,
  uploadError,
  onReplace,
  className,
}: ArtworkPreviewStageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomMode>("fit");
  const [fitScale, setFitScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasVisualPreview = Boolean(preview.imageUrl || preview.svgMarkup);
  const previewKey = preview.imageUrl ?? preview.svgMarkup ?? preview.fileName ?? "empty";

  const { zoomScale } = useMasterArtworkViewport({
    viewportRef,
    artboardRef,
    hasPreview: hasVisualPreview,
    isGenerating: false,
    previewKey,
    zoom,
    setZoom,
    fitScale,
    setFitScale,
  });

  const handleFullscreen = useCallback(() => {
    const el = viewportRef.current?.closest(".dsv2-preview-stage");
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  return (
    <div className={cn("dsv2-preview-stage", isFullscreen && "is-fullscreen", className)}>
      <div className="dsv2-preview-toolbar">
        <div className="dsv2-preview-meta">
          <span className="dsv2-preview-filename">
            {fileName ?? preview.fileName ?? "Master Artwork"}
          </span>
          {preview.mimeType ? (
            <span className="dsv2-preview-type">{preview.mimeType.split("/").pop()}</span>
          ) : null}
          {validationStatus && validationStatus !== "not-uploaded" ? (
            <ValidationStatusBadge status={validationStatus} />
          ) : null}
        </div>
        <div className="dsv2-preview-actions">
          {onReplace ? (
            <button type="button" className="dsv2-preview-replace" onClick={onReplace}>
              Replace
            </button>
          ) : null}
          {hasVisualPreview ? (
            <ViewportControls
              zoom={zoom}
              onZoomChange={setZoom}
              onFit={() => setZoom("fit")}
              onFullscreen={handleFullscreen}
              fitScale={fitScale}
            />
          ) : null}
        </div>
      </div>

      <div ref={viewportRef} className="dsv2-preview-viewport">
        {uploadError ? (
          <div className="dsv2-preview-error" role="alert">
            <AlertCircle className="size-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        ) : null}
        <div
          ref={artboardRef}
          className="dsv2-preview-artboard"
          style={{
            transform: hasVisualPreview ? `scale(${zoomScale})` : undefined,
          }}
        >
          {hasVisualPreview ? (
            <MasterArtworkPreviewSurface canvasBackground="transparent" className="dsv2-preview-surface">
              <MasterArtworkPreviewMedia
                imageUrl={preview.imageUrl}
                svgMarkup={preview.svgMarkup}
                alt={fileName ?? "Master artwork preview"}
                className="dsv2-preview-media"
              />
            </MasterArtworkPreviewSurface>
          ) : (
            <div className="dsv2-preview-placeholder">
              <FileImage className="size-12" strokeWidth={1} />
              <p className="dsv2-preview-placeholder-name">{preview.fileName}</p>
              <p className="dsv2-preview-placeholder-hint">
                Preview support coming soon. File metadata has been captured in the inspector.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
