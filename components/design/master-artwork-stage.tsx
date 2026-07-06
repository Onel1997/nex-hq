"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignDirection } from "@/lib/design/design-directions";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import {
  downloadMasterArtworkPng,
  downloadMasterArtworkPrintFile,
} from "@/lib/design/master-artwork-export";
import {
  resolveMasterArtworkStatusLabel,
  resolveMasterArtworkView,
} from "@/lib/design/master-artwork";
import { MasterArtworkMockupFrame } from "@/components/design/master-artwork-mockup-frame";
import { MasterArtworkPreviewSurface } from "@/components/design/master-artwork-preview-surface";
import {
  DEFAULT_CANVAS_BACKGROUND,
  DEFAULT_MOCKUP_GARMENT,
  MasterArtworkPreviewControls,
  type CanvasBackgroundId,
  type MockupGarmentId,
} from "@/components/design/master-artwork-preview-controls";
import { MasterArtworkThinking } from "@/components/design/master-artwork-thinking";
import { MasterArtworkStatus } from "@/components/design/master-artwork-status";
import { useMasterArtworkReveal } from "@/hooks/use-master-artwork-reveal";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Expand,
  Download,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
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
  revealToken?: number;
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
  revealToken = 0,
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
  const [canvasBackground, setCanvasBackground] = useState<CanvasBackgroundId>(DEFAULT_CANVAS_BACKGROUND);
  const [mockupMode, setMockupMode] = useState(false);
  const [mockupGarment, setMockupGarment] = useState<MockupGarmentId>(DEFAULT_MOCKUP_GARMENT);
  const [fullscreen, setFullscreen] = useState(false);

  const view = useMemo(
    () => resolveMasterArtworkView(assets, versionLabel),
    [assets, versionLabel],
  );
  const isGenerating = loading === "Generate Master Artwork";
  const { phase: revealPhase, isRevealing, isGlowing } = useMasterArtworkReveal(
    revealToken,
    view.hasArtwork,
    isGenerating,
  );

  const isVectorArtwork = view.state.sourceType === "vector-artwork";
  const vectorLabel =
    view.state.vectorArtworkLabel ?? "Vector Artwork — Text Safe";

  const exportMarkup = view.state.approvedSvgMarkup ?? view.previewSvgMarkup ?? assets.svgMarkup;
  const canExport = Boolean(view.hasArtwork && (view.previewImageUrl || exportMarkup));

  const handleDownloadPng = async () => {
    await downloadMasterArtworkPng(view.state, assets, `${brief.designId}-master-artwork`, view);
  };

  const handleDownloadPrintFile = async () => {
    await downloadMasterArtworkPrintFile(view.state, assets, `${brief.designId}-print-production`, view);
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
    const next = Math.min(scaleW, scaleH);
    setFitScale(Math.max(0.35, Math.min(1.25, next)));
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
        view.hasArtwork && "has-artwork",
        !view.hasArtwork && "is-pre-generation",
        isGlowing && "is-artwork-glow",
        revealPhase === "success" && "is-reveal-success",
      )}
      aria-label="Master artwork stage"
    >
      <div className="ma-stage-workspace">
        <div className="ma-stage-chrome">
          <header className="ma-stage-header">
          <div className="ma-stage-title-block">
            {selectedDirection ? (
              <h1 className="ma-stage-artwork-title">{selectedDirection.title}</h1>
            ) : null}
              <p className="ma-stage-direction-meta">
                {versionLabel}
                {isVectorArtwork ? (
                  <span className="ma-approved-banner ma-approved-banner--compact ma-vector-badge">
                    {vectorLabel}
                  </span>
                ) : null}
                {view.isApproved ? (
                  <span className="ma-approved-banner ma-approved-banner--compact">
                    <CheckCircle2 className="size-3" />
                    Approved
                  </span>
                ) : null}
              </p>
            </div>
          </header>

          <div className="ma-artboard-toolbar" role="group" aria-label="Zoom controls">
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
              className="ma-zoom-btn"
              onClick={() => void toggleFullscreen()}
              title="Fullscreen"
              aria-label="Fullscreen"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>

          <MasterArtworkPreviewControls
            canvasBackground={canvasBackground}
            onCanvasBackgroundChange={setCanvasBackground}
            mockupMode={mockupMode}
            onMockupModeChange={setMockupMode}
            mockupGarment={mockupGarment}
            onMockupGarmentChange={setMockupGarment}
            hasArtwork={view.hasArtwork}
          />
        </div>

        <div className="ma-artboard-stack">
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
                  mockupMode && "is-mockup-mode",
                  view.hasArtwork && "has-artwork",
                  view.isApproved && "is-approved",
                  isGenerating && "is-generating",
                  isRevealing && "is-revealing",
                  isGlowing && "is-artwork-glow",
                )}
              >
                {isGenerating ? (
                  <MasterArtworkPreviewSurface canvasBackground={canvasBackground}>
                    <MasterArtworkThinking active variant="canvas" />
                  </MasterArtworkPreviewSurface>
                ) : view.hasArtwork ? (
                  mockupMode ? (
                    <MasterArtworkMockupFrame
                      garment={mockupGarment}
                      imageUrl={view.previewImageUrl}
                      svgMarkup={view.previewSvgMarkup}
                      svgUrl={view.previewSvgUrl}
                    />
                  ) : (
                  <MasterArtworkPreviewSurface canvasBackground={canvasBackground}>
                  <div
                    className={cn(
                      "ma-artwork-preview",
                      isTransitioning && "is-revealing",
                      isRevealing && "is-premium-reveal",
                      isGlowing && "is-premium-settled",
                    )}
                  >
                    <div className="ma-artwork-frame">
                      {view.previewSvgMarkup ? (
                        <div
                          className="ma-artwork-svg"
                          dangerouslySetInnerHTML={{ __html: view.previewSvgMarkup }}
                        />
                      ) : view.previewImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={view.previewImageUrl}
                          alt="Master artwork"
                          className="ma-artwork-img"
                          decoding="async"
                        />
                      ) : view.previewSvgUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={view.previewSvgUrl}
                          alt="Master artwork"
                          className="ma-artwork-img"
                          decoding="async"
                        />
                      ) : null}
                    </div>
                  </div>
                  </MasterArtworkPreviewSurface>
                  )
                ) : (
                  <MasterArtworkPreviewSurface canvasBackground={canvasBackground}>
                  <div className="ma-empty-state">
                    <div className="ma-empty-decor" aria-hidden>
                      <svg className="ma-empty-blueprint" viewBox="0 0 900 900" preserveAspectRatio="none">
                        <line x1="450" y1="0" x2="450" y2="900" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
                        <line x1="0" y1="450" x2="900" y2="450" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
                        <rect x="60" y="60" width="780" height="780" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.12" strokeDasharray="6 8" />
                        <circle cx="450" cy="450" r="180" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.08" />
                      </svg>
                    </div>
                    <div className="ma-empty-glow" aria-hidden />
                    <Sparkles className="ma-empty-icon" />
                    <h2>Generate Master Artwork</h2>
                    <p>Transform the selected direction into a premium transparent streetwear print.</p>
                  </div>
                  </MasterArtworkPreviewSurface>
                )}
              </div>
            </div>

            <MasterArtworkStatus
              phase={revealPhase}
              fallbackLabel={resolveMasterArtworkStatusLabel(
                view.state.status,
                view.state.transparencyWarning,
              )}
              isApproved={view.isApproved}
            />
          </div>
        </div>

        <div className="ma-workspace-footer">
          <div className="ma-workspace-breathe" aria-hidden />
          <div className="ma-workspace-divider" aria-hidden />
          <div className="ma-floating-dock">
            <footer className="ma-stage-actions" aria-label="Master artwork actions">
            <button
              type="button"
              className="cs-btn cs-btn-primary ma-action-dock ma-action-dock--primary"
              onClick={view.hasArtwork ? onRegenerate : onGenerate}
              disabled={Boolean(loading) || (!view.hasArtwork && !canGenerate)}
            >
              {view.hasArtwork ? (
                <RefreshCw className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {view.hasArtwork ? "Regenerate" : "Generate Master Artwork"}
            </button>
            {onRefineDirection ? (
              <button
                type="button"
                className="cs-btn cs-btn-ghost ma-action-dock"
                onClick={onRefineDirection}
                disabled={Boolean(loading)}
              >
                <Wand2 className="size-3.5" />
                Refine Direction
              </button>
            ) : null}
            {onCreateVersion ? (
              <button
                type="button"
                className="cs-btn cs-btn-compact ma-action-dock"
                onClick={() => onCreateVersion(2)}
                disabled={Boolean(loading) || !view.hasArtwork}
              >
                Create Version
              </button>
            ) : null}
            <button
              type="button"
              className="cs-btn cs-btn-compact ma-action-dock"
              onClick={() => void handleDownloadPng()}
              disabled={!canExport}
            >
              <Download className="size-3.5" />
              Download PNG
            </button>
            <button
              type="button"
              className="cs-btn cs-btn-compact ma-action-dock"
              onClick={() => void handleDownloadPrintFile()}
              disabled={!canExport}
            >
              <Download className="size-3.5" />
              Download Print File
            </button>
            <button
              type="button"
              className="cs-btn cs-btn-compact ma-action-dock ma-action-dock--accent"
              onClick={onSendToMarketing}
              disabled={Boolean(loading) || !view.isApproved}
            >
              <Send className="size-3.5" />
              Marketing Studio
            </button>
          </footer>
          </div>
          <div className="ma-workspace-end" aria-hidden />
        </div>
      </div>
    </main>
  );
}
