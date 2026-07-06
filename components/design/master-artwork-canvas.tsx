"use client";

import { DesignEvolutionPanel } from "@/components/design/design-evolution-panel";
import type { DesignDirection, EvolutionAction } from "@/lib/design/design-directions";
import type { DesignStudioBrief } from "@/agents/design/studio-brief";
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
import { cn } from "@/lib/utils";
import { Download, RefreshCw, Send, Shuffle, Sparkles, Stamp, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { MasterArtworkThinking } from "@/components/design/master-artwork-thinking";

function DirectionPreviewMini({ colors }: { colors: string[] }) {
  return (
    <div className="cs-canvas-direction-ref-preview" aria-hidden>
      {colors.slice(0, 4).map((color, index) => (
        <span key={`${color}-${index}`} style={{ background: color }} />
      ))}
    </div>
  );
}

interface MasterArtworkCanvasProps {
  brief: DesignStudioBrief;
  assets: DesignMissionAssets;
  versionLabel: string;
  loading?: string | null;
  hasConcept: boolean;
  canGenerate: boolean;
  selectedDirection?: DesignDirection;
  otherDirections?: DesignDirection[];
  isTransitioning?: boolean;
  chatLoading?: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  onVariation: () => void;
  onApprove: () => void;
  onSendToImageStudio: () => void;
  onEvolve?: (action: EvolutionAction) => void;
  onBlend?: (secondaryId: string) => void;
  onRevision?: (prompt: string) => void;
}

export function MasterArtworkCanvas({
  brief,
  assets,
  versionLabel,
  loading,
  hasConcept,
  canGenerate,
  selectedDirection,
  otherDirections = [],
  isTransitioning,
  chatLoading,
  onGenerate,
  onRegenerate,
  onVariation,
  onApprove,
  onSendToImageStudio,
  onEvolve,
  onRevision,
}: MasterArtworkCanvasProps) {
  const view = useMemo(
    () => resolveMasterArtworkView(assets, versionLabel),
    [assets, versionLabel],
  );
  const isGenerating = loading === "Generate Master Artwork";
  const [canvasBackground, setCanvasBackground] = useState<CanvasBackgroundId>(DEFAULT_CANVAS_BACKGROUND);
  const [mockupMode, setMockupMode] = useState(false);
  const [mockupGarment, setMockupGarment] = useState<MockupGarmentId>(DEFAULT_MOCKUP_GARMENT);

  const exportMarkup = view.state.approvedSvgMarkup ?? view.previewSvgMarkup ?? assets.svgMarkup;
  const canExport = Boolean(view.hasArtwork && (view.previewImageUrl || exportMarkup));

  const handleDownloadPng = async () => {
    await downloadMasterArtworkPng(view.state, assets, `${brief.designId}-master-artwork`, view);
  };

  const handleDownloadPrint = async () => {
    await downloadMasterArtworkPrintFile(view.state, assets, `${brief.designId}-print-file`, view);
  };

  return (
    <main
      className={cn("cs-canvas cs-canvas-hero", isTransitioning && "is-transitioning")}
      aria-label="Master artwork stage"
    >
      {selectedDirection ? (
        <div className={cn("cs-canvas-source cs-canvas-source--compact", isTransitioning && "is-animating")}>
          <Trophy className="size-3 text-[#52c2c2]" />
          <strong>{selectedDirection.title}</strong>
        </div>
      ) : null}

      <div className="cs-canvas-stage">
        <div className="cs-canvas-spotlight" aria-hidden />
        <div className="cs-canvas-vignette" aria-hidden />
        <MasterArtworkPreviewControls
          canvasBackground={canvasBackground}
          onCanvasBackgroundChange={setCanvasBackground}
          mockupMode={mockupMode}
          onMockupModeChange={setMockupMode}
          mockupGarment={mockupGarment}
          onMockupGarmentChange={setMockupGarment}
          hasArtwork={view.hasArtwork}
          compact
        />
        <div
          className={cn(
            "cs-canvas-artboard",
            mockupMode && "is-mockup-mode",
            isTransitioning && "is-receiving",
            view.hasArtwork && "has-artwork",
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
            <div className={cn("cs-canvas-preview", isTransitioning && "is-revealing")}>
              {view.previewImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={view.previewImageUrl} alt="Master artwork" className="cs-canvas-img" />
              ) : view.previewSvgMarkup ? (
                <div
                  className="cs-canvas-svg"
                  dangerouslySetInnerHTML={{ __html: view.previewSvgMarkup }}
                />
              ) : view.previewSvgUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={view.previewSvgUrl} alt="Master artwork" className="cs-canvas-img" />
              ) : null}
            </div>
            </MasterArtworkPreviewSurface>
            )
          ) : (
            <div className="cs-canvas-empty cs-canvas-empty--direction">
              {selectedDirection ? (
                <>
                  <div className="cs-canvas-direction-ref">
                    <DirectionPreviewMini colors={selectedDirection.thumbnailColors} />
                    <div>
                      <p className="cs-canvas-direction-ref-kicker">Selected Creative Direction</p>
                      <p className="cs-canvas-direction-title">{selectedDirection.title}</p>
                      <p className="cs-canvas-direction-mood">{selectedDirection.philosophy}</p>
                    </div>
                  </div>
                  <p className="cs-canvas-unlock-copy">
                    Your selected direction is locked in. Generate master artwork to enter production review.
                  </p>
                </>
              ) : (
                <>
                  <Sparkles className="size-10 text-[#52c2c2]/80" />
                  <p>Select a direction, then generate master artwork.</p>
                </>
              )}
              {hasConcept && canGenerate ? (
                <button type="button" className="cs-btn cs-btn-primary cs-btn-generate-master" onClick={onGenerate}>
                  <Sparkles className="size-4" />
                  Generate Master Artwork
                </button>
              ) : null}
            </div>
          )}
        </div>
        <span
          className={cn(
            "cs-canvas-status",
            view.isApproved && "is-approved",
          )}
        >
          {resolveMasterArtworkStatusLabel(view.state.status)}
        </span>
      </div>

      <div className="cs-canvas-toolbar cs-canvas-toolbar--slim">
        <div className="cs-canvas-toolbar-primary">
          <button
            type="button"
            className="cs-btn cs-btn-approve cs-btn-compact"
            onClick={onApprove}
            disabled={Boolean(loading) || !view.canApprove}
          >
            <Stamp className="size-3.5" />
            Approve
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-compact"
            onClick={onRegenerate}
            disabled={Boolean(loading) || !view.hasArtwork}
          >
            <RefreshCw className="size-3.5" />
            Regenerate
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-compact"
            onClick={onVariation}
            disabled={Boolean(loading) || !view.hasArtwork}
          >
            <Shuffle className="size-3.5" />
            Variation
          </button>
        </div>
        <div className="cs-canvas-toolbar-secondary">
          <button
            type="button"
            className="cs-btn cs-btn-compact cs-btn-ghost"
            onClick={() => void handleDownloadPng()}
            disabled={!canExport}
          >
            <Download className="size-3.5" />
            PNG
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-compact cs-btn-ghost"
            onClick={() => void handleDownloadPrint()}
            disabled={!canExport}
          >
            <Download className="size-3.5" />
            Print
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-accent cs-btn-compact"
            onClick={onSendToImageStudio}
            disabled={Boolean(loading) || !view.canSendToImageStudio}
          >
            <Send className="size-3.5" />
            Production
          </button>
        </div>
      </div>

      {selectedDirection && onEvolve && onRevision ? (
        <DesignEvolutionPanel
          direction={selectedDirection}
          onEvolve={onEvolve}
          onRevision={onRevision}
          revisionLoading={chatLoading}
          disabled={Boolean(loading)}
        />
      ) : null}
    </main>
  );
}
