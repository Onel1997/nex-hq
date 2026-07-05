"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignDirection } from "@/lib/design/design-directions";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import {
  downloadPngFromSvg,
  downloadPngFromUrl,
  resolveMasterArtworkStatusLabel,
  resolveMasterArtworkView,
} from "@/lib/design/master-artwork";
import { MasterArtworkThinking } from "@/components/design/master-artwork-thinking";
import { cn } from "@/lib/utils";
import {
  Download,
  Expand,
  Grid3x3,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Stamp,
  Wand2,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

type ZoomMode = "fit" | 0.5 | 0.75 | 1 | 1.25 | 1.5;

interface MasterArtworkStageProps {
  brief: DesignStudioBrief;
  assets: DesignMissionAssets;
  versionLabel: string;
  loading?: string | null;
  canGenerate: boolean;
  selectedDirection?: DesignDirection;
  isTransitioning?: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onRefineDirection?: () => void;
  onCreateVersion?: (version: 2 | 3) => void;
  onSendToMarketing?: () => void;
  onSendToImageStudio?: () => void;
}

function ArtworkMetadata({
  brief,
  view,
}: {
  brief: DesignStudioBrief;
  view: ReturnType<typeof resolveMasterArtworkView>;
}) {
  const { state } = view;
  const items = [
    { label: "Resolution", value: state.resolution ?? state.resolutionLabel ?? "—" },
    { label: "DPI Target", value: state.dpi != null ? `${state.dpi} DPI` : "300 DPI" },
    {
      label: "Transparent",
      value: state.transparentBackground ?? state.transparency ? "Yes" : "—",
    },
    { label: "Print Area", value: brief.printArea },
    { label: "Placement", value: state.placement ?? brief.placement },
    { label: "Mode", value: state.generationMode ?? "draft" },
    {
      label: "Commercial",
      value: state.commercialScore != null ? `${Math.round(state.commercialScore)}%` : "—",
    },
    { label: "Print Ready", value: state.printReadiness ?? (state.printReady ? "Yes" : "—") },
  ];

  return (
    <div className="ma-meta-bar" aria-label="Artwork metadata">
      {items.map((item) => (
        <div key={item.label} className="ma-meta-item">
          <span className="ma-meta-label">{item.label}</span>
          <span className="ma-meta-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MasterArtworkStage({
  brief,
  assets,
  versionLabel,
  loading,
  canGenerate,
  selectedDirection,
  isTransitioning,
  onGenerate,
  onRegenerate,
  onApprove,
  onRefineDirection,
  onCreateVersion,
  onSendToMarketing,
  onSendToImageStudio,
}: MasterArtworkStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState<ZoomMode>("fit");
  const [checkerboard, setCheckerboard] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const view = useMemo(
    () => resolveMasterArtworkView(assets, versionLabel),
    [assets, versionLabel],
  );
  const isGenerating = loading === "Generate Master Artwork";

  const exportImageUrl =
    view.state.approvedArtworkUrl ??
    view.state.approvedProductionFileUrl ??
    view.previewImageUrl;
  const exportMarkup = view.state.approvedSvgMarkup ?? view.previewSvgMarkup ?? assets.svgMarkup;

  const handleDownloadPng = async () => {
    if (exportImageUrl) {
      await downloadPngFromUrl(exportImageUrl, `${brief.designId}-master-artwork`);
      return;
    }
    if (exportMarkup) {
      await downloadPngFromSvg(exportMarkup, `${brief.designId}-master-artwork`);
    }
  };

  const toggleFullscreen = useCallback(async () => {
    const el = stageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  }, []);

  const zoomScale = zoom === "fit" ? 1 : zoom;

  return (
    <main
      ref={stageRef}
      className={cn(
        "ma-stage",
        isTransitioning && "is-transitioning",
        fullscreen && "is-fullscreen",
      )}
      aria-label="Master artwork stage"
    >
      <header className="ma-stage-header">
        <div className="ma-stage-title-block">
          <p className="ma-stage-kicker">Master Artwork</p>
          <h1 className="ma-stage-title">Print-Ready Design</h1>
          {selectedDirection ? (
            <p className="ma-stage-direction">
              From <strong>{selectedDirection.title}</strong> · {versionLabel}
            </p>
          ) : null}
        </div>

        <div className="ma-stage-zoom" role="group" aria-label="Zoom controls">
          <button
            type="button"
            className={cn("ma-zoom-btn", zoom === "fit" && "is-active")}
            onClick={() => setZoom("fit")}
            title="Fit"
          >
            <Expand className="size-3.5" />
            Fit
          </button>
          <button
            type="button"
            className={cn("ma-zoom-btn", zoom === 1 && "is-active")}
            onClick={() => setZoom(1)}
          >
            100%
          </button>
          <button
            type="button"
            className="ma-zoom-btn"
            onClick={() =>
              setZoom((current) => {
                if (current === "fit") return 0.75;
                const next = Math.max(0.5, (current as number) - 0.25);
                return next as ZoomMode;
              })
            }
            title="Zoom out"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            type="button"
            className="ma-zoom-btn"
            onClick={() =>
              setZoom((current) => {
                if (current === "fit") return 1;
                const next = Math.min(1.5, (current as number) + 0.25);
                return next as ZoomMode;
              })
            }
            title="Zoom in"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            className={cn("ma-zoom-btn", checkerboard && "is-active")}
            onClick={() => setCheckerboard((v) => !v)}
            title="Toggle transparency grid"
          >
            <Grid3x3 className="size-3.5" />
          </button>
          <button type="button" className="ma-zoom-btn" onClick={() => void toggleFullscreen()} title="Fullscreen">
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="ma-stage-hero">
        <div className="ma-stage-spotlight" aria-hidden />
        <div className="ma-stage-vignette" aria-hidden />

        <div
          className={cn(
            "ma-artboard",
            checkerboard && "has-checker",
            view.hasArtwork && "has-artwork",
            isGenerating && "is-generating",
          )}
          style={zoom !== "fit" ? { transform: `scale(${zoomScale})` } : undefined}
        >
          {isGenerating ? (
            <MasterArtworkThinking active variant="canvas" />
          ) : view.hasArtwork ? (
            <div className={cn("ma-artwork-preview", isTransitioning && "is-revealing")}>
              {view.previewImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={view.previewImageUrl} alt="Master artwork" className="ma-artwork-img" />
              ) : view.previewSvgMarkup ? (
                <div
                  className="ma-artwork-svg"
                  dangerouslySetInnerHTML={{ __html: view.previewSvgMarkup }}
                />
              ) : view.previewSvgUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={view.previewSvgUrl} alt="Master artwork" className="ma-artwork-img" />
              ) : null}
            </div>
          ) : (
            <div className="ma-empty-state">
              <div className="ma-empty-glow" aria-hidden />
              <Sparkles className="ma-empty-icon" />
              <h2>Ready to create the Master Artwork</h2>
              <p>
                The selected direction will be transformed into a print-ready apparel design.
              </p>
              <div className="ma-empty-actions">
                {canGenerate ? (
                  <button
                    type="button"
                    className="cs-btn cs-btn-primary ma-btn-generate"
                    onClick={onGenerate}
                    disabled={Boolean(loading)}
                  >
                    <Sparkles className="size-4" />
                    Generate Master Artwork
                  </button>
                ) : null}
                {onRefineDirection ? (
                  <button
                    type="button"
                    className="cs-btn cs-btn-ghost ma-btn-refine"
                    onClick={onRefineDirection}
                    disabled={Boolean(loading)}
                  >
                    <Wand2 className="size-4" />
                    Refine Direction
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <span className={cn("ma-stage-status", view.isApproved && "is-approved")}>
          {resolveMasterArtworkStatusLabel(view.state.status)}
        </span>
      </div>

      {view.hasArtwork ? <ArtworkMetadata brief={brief} view={view} /> : null}

      <footer className="ma-stage-actions">
        <div className="ma-actions-primary">
          {!view.hasArtwork ? (
            <button
              type="button"
              className="cs-btn cs-btn-primary"
              onClick={onGenerate}
              disabled={Boolean(loading) || !canGenerate}
            >
              <Sparkles className="size-4" />
              Generate Master Artwork
            </button>
          ) : (
            <>
              <button
                type="button"
                className="cs-btn cs-btn-primary cs-btn-approve"
                onClick={onApprove}
                disabled={Boolean(loading) || !view.canApprove}
              >
                <Stamp className="size-4" />
                Approve Artwork
              </button>
              <button
                type="button"
                className="cs-btn"
                onClick={onRegenerate}
                disabled={Boolean(loading)}
              >
                <RefreshCw className="size-4" />
                Regenerate
              </button>
            </>
          )}
        </div>

        <div className="ma-actions-secondary">
          {onCreateVersion ? (
            <>
              <button
                type="button"
                className="cs-btn cs-btn-compact"
                onClick={() => onCreateVersion(2)}
                disabled={Boolean(loading) || !view.hasArtwork}
              >
                Create Version 2
              </button>
              <button
                type="button"
                className="cs-btn cs-btn-compact"
                onClick={() => onCreateVersion(3)}
                disabled={Boolean(loading) || !view.hasArtwork}
              >
                Create Version 3
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="cs-btn cs-btn-compact"
            onClick={() => void handleDownloadPng()}
            disabled={!exportImageUrl && !exportMarkup}
          >
            <Download className="size-3.5" />
            Download PNG
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-accent cs-btn-compact"
            onClick={onSendToMarketing}
            disabled={Boolean(loading) || !view.isApproved}
          >
            <Send className="size-3.5" />
            Send to Marketing Studio
          </button>
          {onSendToImageStudio ? (
            <button
              type="button"
              className="cs-btn cs-btn-compact cs-btn-ghost"
              onClick={onSendToImageStudio}
              disabled={Boolean(loading) || !view.isApproved}
            >
              <Send className="size-3.5" />
              Image Studio
            </button>
          ) : null}
        </div>
      </footer>
    </main>
  );
}
