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
  CheckCircle2,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ZoomMode = "fit" | number;

interface MasterArtworkStageProps {
  brief: DesignStudioBrief;
  assets: DesignMissionAssets;
  versionLabel: string;
  loading?: string | null;
  canGenerate: boolean;
  selectedDirection?: DesignDirection;
  isTransitioning?: boolean;
  focusMode?: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onRefineDirection?: () => void;
  onCreateVersion?: (version: 2 | 3) => void;
  onSendToMarketing?: () => void;
  onSendToImageStudio?: () => void;
}

export function MasterArtworkStage({
  brief,
  assets,
  versionLabel,
  loading,
  canGenerate,
  selectedDirection,
  isTransitioning,
  focusMode = false,
  onGenerate,
  onRegenerate,
  onApprove,
  onRefineDirection,
  onCreateVersion,
  onSendToMarketing,
}: MasterArtworkStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomMode>("fit");
  const [fitScale, setFitScale] = useState(1);
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
  const printFileUrl =
    view.state.approvedProductionFileUrl ??
    view.state.productionPngUrl ??
    exportImageUrl;
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

  const handleDownloadPrintFile = async () => {
    if (printFileUrl) {
      await downloadPngFromUrl(printFileUrl, `${brief.designId}-print-production`);
      return;
    }
    if (exportMarkup) {
      await downloadPngFromSvg(exportMarkup, `${brief.designId}-print-production`);
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

  const recomputeFit = useCallback(() => {
    const hero = heroRef.current;
    const artboard = artboardRef.current;
    if (!hero || !artboard || !view.hasArtwork) {
      setFitScale(1);
      return;
    }

    const heroRect = hero.getBoundingClientRect();
    const artboardRect = artboard.getBoundingClientRect();
    if (artboardRect.width <= 0 || artboardRect.height <= 0) return;

    const padding = focusMode ? 12 : 20;
    const availableW = heroRect.width - padding * 2;
    const availableH = heroRect.height - padding * 2;
    const scaleW = availableW / artboardRect.width;
    const scaleH = availableH / artboardRect.height;
    const next = Math.min(scaleW, scaleH, focusMode ? 1.75 : 1.55);
    setFitScale(Math.max(0.4, next));
  }, [focusMode, view.hasArtwork]);

  useEffect(() => {
    recomputeFit();
    const hero = heroRef.current;
    if (!hero) return;

    const observer = new ResizeObserver(() => recomputeFit());
    observer.observe(hero);
    return () => observer.disconnect();
  }, [recomputeFit, view.hasArtwork, view.previewImageUrl, focusMode]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
      window.requestAnimationFrame(recomputeFit);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [recomputeFit]);

  const zoomScale = zoom === "fit" ? fitScale : zoom;

  const zoomOut = () => {
    setZoom((current) => {
      const base = current === "fit" ? fitScale : current;
      return Math.max(0.35, Math.round((base - 0.1) * 100) / 100);
    });
  };

  const zoomIn = () => {
    setZoom((current) => {
      const base = current === "fit" ? fitScale : current;
      return Math.min(2, Math.round((base + 0.1) * 100) / 100);
    });
  };

  return (
    <main
      ref={stageRef}
      className={cn(
        "ma-stage",
        isTransitioning && "is-transitioning",
        fullscreen && "is-fullscreen",
        focusMode && "is-focus-mode",
        view.isApproved && "is-approved",
      )}
      aria-label="Master artwork stage"
    >
      <header className="ma-stage-header">
        <div className="ma-stage-title-block">
          <p className="ma-stage-kicker">Master Artwork</p>
          {selectedDirection ? (
            <h1 className="ma-stage-artwork-title">{selectedDirection.title}</h1>
          ) : null}
          <p className="ma-stage-direction-meta">
            {versionLabel}
            {view.isApproved ? (
              <span className="ma-approved-banner ma-approved-banner--compact">
                <CheckCircle2 className="size-3" />
                Approved
              </span>
            ) : null}
          </p>
        </div>

        <div className="ma-stage-zoom" role="group" aria-label="Zoom controls">
          <button
            type="button"
            className={cn("ma-zoom-btn", zoom === "fit" && "is-active")}
            onClick={() => setZoom("fit")}
            title="Fit"
            aria-label="Fit to canvas"
          >
            <Expand className="size-3.5" />
            <span className="ma-zoom-label">Fit</span>
          </button>
          <button
            type="button"
            className={cn("ma-zoom-btn", zoom === 1 && "is-active")}
            onClick={() => setZoom(1)}
            title="100%"
          >
            100%
          </button>
          <span className="ma-zoom-divider" aria-hidden />
          <button type="button" className="ma-zoom-btn" onClick={zoomOut} title="Zoom out" aria-label="Zoom out">
            <Minus className="size-3.5" />
          </button>
          <button type="button" className="ma-zoom-btn" onClick={zoomIn} title="Zoom in" aria-label="Zoom in">
            <Plus className="size-3.5" />
          </button>
          <span className="ma-zoom-divider" aria-hidden />
          <button
            type="button"
            className={cn("ma-zoom-btn", checkerboard && "is-active")}
            onClick={() => setCheckerboard((v) => !v)}
            title="Toggle grid"
            aria-label="Toggle transparency grid"
          >
            <Grid3x3 className="size-3.5" />
          </button>
          <button
            type="button"
            className="ma-zoom-btn"
            onClick={() => void toggleFullscreen()}
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </header>

      <div ref={heroRef} className="ma-stage-hero">
        <div className="ma-stage-spotlight" aria-hidden />
        <div className="ma-stage-vignette" aria-hidden />

        <div
          className="ma-artboard-wrap"
          style={{
            transform: `scale(${zoomScale})`,
            transition: "transform 220ms ease-in-out",
          }}
        >
          <div
            ref={artboardRef}
            className={cn(
              "ma-artboard",
              checkerboard && "has-checker",
              view.hasArtwork && "has-artwork",
              view.isApproved && "is-approved",
              isGenerating && "is-generating",
            )}
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
                <h2>Ready to create Master Artwork</h2>
                <p>Transform the selected direction into a print-ready apparel design.</p>
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
        </div>

        <span className={cn("ma-stage-status", view.isApproved && "is-approved")}>
          {resolveMasterArtworkStatusLabel(view.state.status)}
        </span>
      </div>

      <footer className="ma-stage-actions">
        <div className="ma-actions-primary">
          {!view.hasArtwork ? (
            <button
              type="button"
              className="cs-btn cs-btn-primary ma-action-primary"
              onClick={onGenerate}
              disabled={Boolean(loading) || !canGenerate}
            >
              <Sparkles className="size-4" />
              Generate Master Artwork
            </button>
          ) : (
            <button
              type="button"
              className="cs-btn cs-btn-primary ma-action-primary"
              onClick={onRegenerate}
              disabled={Boolean(loading)}
            >
              <RefreshCw className="size-4" />
              Regenerate
            </button>
          )}
        </div>

        <div className="ma-actions-secondary">
          {view.hasArtwork ? (
            <button
              type="button"
              className="cs-btn cs-btn-compact ma-action-secondary"
              onClick={onApprove}
              disabled={Boolean(loading) || !view.canApprove}
            >
              <Stamp className="size-3.5" />
              Approve
            </button>
          ) : null}
          {onRefineDirection ? (
            <button
              type="button"
              className="cs-btn cs-btn-ghost cs-btn-compact ma-action-tertiary"
              onClick={onRefineDirection}
              disabled={Boolean(loading)}
            >
              <Wand2 className="size-3.5" />
              Refine Direction
            </button>
          ) : null}
          {onCreateVersion ? (
            <>
              <button
                type="button"
                className="cs-btn cs-btn-compact ma-action-tertiary"
                onClick={() => onCreateVersion(2)}
                disabled={Boolean(loading) || !view.hasArtwork}
              >
                Version 2
              </button>
              <button
                type="button"
                className="cs-btn cs-btn-compact ma-action-tertiary"
                onClick={() => onCreateVersion(3)}
                disabled={Boolean(loading) || !view.hasArtwork}
              >
                Version 3
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="cs-btn cs-btn-compact ma-action-secondary"
            onClick={() => void handleDownloadPng()}
            disabled={!exportImageUrl && !exportMarkup}
          >
            <Download className="size-3.5" />
            Download PNG
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-compact ma-action-tertiary"
            onClick={() => void handleDownloadPrintFile()}
            disabled={!printFileUrl && !exportMarkup}
          >
            Download Print File
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-compact ma-action-secondary"
            onClick={onSendToMarketing}
            disabled={Boolean(loading) || !view.isApproved}
          >
            <Send className="size-3.5" />
            Marketing Studio
          </button>
        </div>
      </footer>
    </main>
  );
}
