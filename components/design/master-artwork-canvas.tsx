"use client";

import type { DesignDirection } from "@/lib/design/design-directions";
import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import {
  downloadPngFromSvg,
  downloadPngFromUrl,
  resolveMasterArtworkStatusLabel,
  resolveMasterArtworkView,
} from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";
import { Download, RefreshCw, Send, Shuffle, Sparkles, Stamp } from "lucide-react";
import { useMemo } from "react";
import { MasterArtworkThinking } from "@/components/design/master-artwork-thinking";

interface MasterArtworkCanvasProps {
  brief: DesignStudioBrief;
  assets: DesignMissionAssets;
  versionLabel: string;
  loading?: string | null;
  hasConcept: boolean;
  canGenerate: boolean;
  selectedDirection?: DesignDirection;
  onGenerate: () => void;
  onRegenerate: () => void;
  onVariation: () => void;
  onApprove: () => void;
  onSendToImageStudio: () => void;
}

export function MasterArtworkCanvas({
  brief,
  assets,
  versionLabel,
  loading,
  hasConcept,
  canGenerate,
  selectedDirection,
  onGenerate,
  onRegenerate,
  onVariation,
  onApprove,
  onSendToImageStudio,
}: MasterArtworkCanvasProps) {
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
    view.state.transparentPngUrl ??
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

  const handleDownloadPrint = async () => {
    if (printFileUrl) {
      await downloadPngFromUrl(printFileUrl, `${brief.designId}-print-file`);
    }
  };

  return (
    <main className="cs-canvas" aria-label="Master artwork stage">
      <div className="cs-canvas-stage">
        <div className="cs-canvas-spotlight" aria-hidden />
        <div className="cs-canvas-vignette" aria-hidden />
        <div className="cs-canvas-artboard">
          {isGenerating ? (
            <MasterArtworkThinking active variant="canvas" />
          ) : view.hasArtwork ? (
            <div className="cs-canvas-preview">
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
          ) : (
            <div className="cs-canvas-empty">
              <Sparkles className="size-10 text-[#d9b46b]/80" />
              {selectedDirection ? (
                <>
                  <p className="cs-canvas-direction-title">{selectedDirection.title}</p>
                  <p className="cs-canvas-direction-mood">
                    {selectedDirection.mood} · {selectedDirection.typography} · {selectedDirection.printStyle}
                  </p>
                </>
              ) : (
                <p>Select a direction, then generate master artwork.</p>
              )}
              {hasConcept && canGenerate ? (
                <button type="button" className="cs-btn cs-btn-primary" onClick={onGenerate}>
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

      <div className="cs-canvas-toolbar">
        <button
          type="button"
          className="cs-btn cs-btn-primary"
          onClick={onApprove}
          disabled={Boolean(loading) || !view.canApprove}
        >
          <Stamp className="size-4" />
          Approve
        </button>
        <button
          type="button"
          className="cs-btn"
          onClick={onRegenerate}
          disabled={Boolean(loading) || !view.hasArtwork}
        >
          <RefreshCw className="size-4" />
          Regenerate
        </button>
        <button
          type="button"
          className="cs-btn"
          onClick={onVariation}
          disabled={Boolean(loading) || !view.hasArtwork}
        >
          <Shuffle className="size-4" />
          Variation
        </button>
        <button
          type="button"
          className="cs-btn"
          onClick={() => void handleDownloadPng()}
          disabled={!exportImageUrl && !exportMarkup}
        >
          <Download className="size-4" />
          Download PNG
        </button>
        <button
          type="button"
          className="cs-btn"
          onClick={() => void handleDownloadPrint()}
          disabled={!printFileUrl}
        >
          <Download className="size-4" />
          Download Print File
        </button>
        <button
          type="button"
          className="cs-btn cs-btn-accent"
          onClick={onSendToImageStudio}
          disabled={Boolean(loading) || !view.canSendToImageStudio}
        >
          <Send className="size-4" />
          Send to Image Studio
        </button>
      </div>
    </main>
  );
}
