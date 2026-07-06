"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import {
  downloadMasterArtworkPng,
  downloadMasterArtworkSvg,
} from "@/lib/design/master-artwork-export";
import {
  resolveMasterArtworkStatusLabel,
  resolveMasterArtworkView,
} from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Stamp,
} from "lucide-react";
import { useMemo } from "react";
import { MasterArtworkThinking } from "@/components/design/master-artwork-thinking";

interface MasterArtworkShowcaseProps {
  brief: DesignStudioBrief;
  assets: DesignMissionAssets;
  versionLabel: string;
  loading?: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onSendToImageStudio: () => void;
}

export function MasterArtworkShowcase({
  brief,
  assets,
  versionLabel,
  loading,
  onGenerate,
  onRegenerate,
  onApprove,
  onSendToImageStudio,
}: MasterArtworkShowcaseProps) {
  const view = useMemo(
    () => resolveMasterArtworkView(assets, versionLabel),
    [assets, versionLabel],
  );
  const isGenerating = loading === "Generate Master Artwork";
  const hasAiConcept = Boolean(assets.aiDesignerConcept);
  const canExport = Boolean(view.hasArtwork);
  const hasSvgExport = Boolean(
    view.state.approvedSvgMarkup ?? view.previewSvgMarkup ?? assets.svgMarkup,
  );

  const handleDownloadPng = async () => {
    await downloadMasterArtworkPng(view.state, assets, `${brief.designId}-master-artwork`, view);
  };

  const handleDownloadSvg = async () => {
    await downloadMasterArtworkSvg(assets, `${brief.designId}-master-artwork`, view);
  };

  return (
    <section className="cw-v2-master-showcase" aria-label="Master artwork showcase">
      <header className="cw-v2-master-showcase-header">
        <div>
          <p className="cw-v2-kicker">Production · Creative Source of Truth</p>
          <h2 className="cw-v2-master-showcase-title">Master Artwork</h2>
          <p className="cw-v2-master-showcase-subtitle">
            The approved artwork is immutable. Image Studio derives hero, mockups, lifestyle, social, and Shopify assets from this file only.
          </p>
        </div>
        <span
          className={cn(
            "cw-v2-master-status",
            view.isApproved && "is-approved",
            view.state.status === "in_review" && "is-review",
            view.state.status === "draft" && "is-draft",
          )}
        >
          {resolveMasterArtworkStatusLabel(view.state.status)}
        </span>
      </header>

      <div className="cw-v2-master-showcase-stage">
        <div className="cw-v2-master-showcase-glow" aria-hidden />
        <div className="cw-v2-master-showcase-vignette" aria-hidden />

        {isGenerating ? (
          <MasterArtworkThinking active />
        ) : view.hasArtwork ? (
          <div className="cw-v2-master-showcase-preview">
            {view.previewImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={view.previewImageUrl}
                alt="Master artwork preview"
                className="cw-v2-master-showcase-img"
              />
            ) : view.previewSvgMarkup ? (
              <div
                className="cw-v2-master-showcase-svg"
                dangerouslySetInnerHTML={{ __html: view.previewSvgMarkup }}
              />
            ) : view.previewSvgUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={view.previewSvgUrl}
                alt="Master artwork preview"
                className="cw-v2-master-showcase-img"
              />
            ) : null}
          </div>
        ) : (
          <div className="cw-v2-master-showcase-empty">
            <Sparkles className="size-8 text-[#52c2c2]/80" />
            <h3>Master Artwork</h3>
            <p>
              Select a design direction, then generate a single transparent print-ready artwork.
            </p>
          </div>
        )}
      </div>

      <div className="cw-v2-master-showcase-footer">
        <div className="cw-v2-master-meta">
          <span>Version {view.state.version || versionLabel}</span>
          <span>{view.sourceLabel}</span>
          {view.state.commercialScore != null ? (
            <span>Commercial {Math.round(view.state.commercialScore)}%</span>
          ) : assets.commercialScore != null ? (
            <span>Commercial {Math.round(assets.commercialScore)}%</span>
          ) : null}
          {view.state.resolution ? <span>{view.state.resolution}</span> : null}
        </div>

        <div className="cw-v2-master-actions">
          <button
            type="button"
            className="cw-btn cw-btn-primary"
            onClick={onGenerate}
            disabled={Boolean(loading) || !hasAiConcept}
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate Master Artwork
          </button>
          <button
            type="button"
            className="cw-btn cw-btn-secondary"
            onClick={onRegenerate}
            disabled={Boolean(loading) || !view.hasArtwork}
          >
            <RefreshCw className="size-4" />
            Regenerate
          </button>
          <button
            type="button"
            className="cw-btn cw-btn-secondary"
            onClick={onApprove}
            disabled={Boolean(loading) || !view.canApprove}
          >
            <Stamp className="size-4" />
            Approve Artwork
          </button>
          <button
            type="button"
            className="cw-btn cw-btn-secondary"
            onClick={() => void handleDownloadPng()}
            disabled={!canExport}
          >
            <Download className="size-4" />
            Download PNG
          </button>
          {hasSvgExport ? (
            <button
              type="button"
              className="cw-btn cw-btn-secondary"
              onClick={() => void handleDownloadSvg()}
              title="Optional vector export"
            >
              <Download className="size-4" />
              SVG Draft
            </button>
          ) : null}
          <button
            type="button"
            className="cw-btn cw-btn-accent"
            onClick={onSendToImageStudio}
            disabled={Boolean(loading) || !view.canSendToImageStudio}
          >
            <Send className="size-4" />
            Send to Image Studio
          </button>
        </div>

        {view.isApproved ? (
          <p className="cw-v2-master-approved">
            <CheckCircle2 className="size-4" />
            Approved master artwork is locked. Image Studio will derive production assets without redesigning.
          </p>
        ) : view.hasArtwork ? (
          <p className="cw-v2-master-hint">Approve Master Artwork before production handoff.</p>
        ) : !hasAiConcept ? (
          <p className="cw-v2-master-hint">Generate an AI Design Concept and select a design direction first.</p>
        ) : null}
      </div>
    </section>
  );
}
