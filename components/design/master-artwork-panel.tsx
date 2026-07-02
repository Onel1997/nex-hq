"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import {
  downloadPngFromSvg,
  downloadSvgAsset,
  resolveMasterArtworkStatusLabel,
  resolveMasterArtworkView,
  type MasterArtworkViewModel,
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

interface MasterArtworkPanelProps {
  brief: DesignStudioBrief;
  assets: DesignMissionAssets;
  versionLabel: string;
  loading?: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onSendToImageStudio: () => void;
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="cw-master-meta-field">
      <span className="cw-master-meta-label">{label}</span>
      <span className="cw-master-meta-value">{value}</span>
    </div>
  );
}

function ArtworkPreview({ view }: { view: MasterArtworkViewModel }) {
  if (!view.hasArtwork) {
    return (
      <div className="cw-master-preview cw-master-preview--empty">
        <p>Master artwork not generated yet.</p>
        <p className="cw-master-preview-hint">
          Design Studio creates the print artwork here. Image Studio will use the approved version for
          all production assets — never redesign it.
        </p>
      </div>
    );
  }

  if (view.previewSvgMarkup) {
    return (
      <div
        className="cw-master-preview cw-master-preview--svg"
        dangerouslySetInnerHTML={{ __html: view.previewSvgMarkup }}
      />
    );
  }

  if (view.previewSvgUrl) {
    return (
      <div className="cw-master-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={view.previewSvgUrl} alt="Master artwork preview" className="cw-master-preview-img" />
      </div>
    );
  }

  return null;
}

export function MasterArtworkPanel({
  brief,
  assets,
  versionLabel,
  loading,
  onGenerate,
  onRegenerate,
  onApprove,
  onSendToImageStudio,
}: MasterArtworkPanelProps) {
  const view = useMemo(
    () => resolveMasterArtworkView(assets, versionLabel),
    [assets, versionLabel],
  );
  const isGenerating = loading === "Generate Master Artwork" || loading === "Generate SVG";
  const exportMarkup =
    view.state.approvedSvgMarkup ?? view.previewSvgMarkup ?? assets.svgMarkup;

  const handleDownloadPng = async () => {
    if (!exportMarkup) return;
    await downloadPngFromSvg(exportMarkup, `${brief.designId}-master-artwork`);
  };

  const handleDownloadSvg = async () => {
    if (!exportMarkup) return;
    await downloadSvgAsset(exportMarkup, `${brief.designId}-master-artwork`);
  };

  return (
    <section className="cw-master-artwork" aria-labelledby="cw-master-artwork-title">
      <header className="cw-master-artwork-header">
        <div>
          <p className="cw-master-kicker">Production · Creative Source of Truth</p>
          <h2 id="cw-master-artwork-title" className="cw-master-title">
            Master Artwork
          </h2>
          <p className="cw-master-subtitle">
            The actual print artwork — typography, graphics, symbols, and composition. Image Studio
            derives production from this asset only.
          </p>
        </div>
        <span
          className={cn(
            "cw-master-status-badge",
            view.isApproved && "is-approved",
            view.state.status === "in_review" && "is-review",
            view.state.status === "draft" && "is-draft",
          )}
        >
          {resolveMasterArtworkStatusLabel(view.state.status)}
        </span>
      </header>

      <div className="cw-master-artwork-body">
        <ArtworkPreview view={view} />

        <div className="cw-master-artwork-side">
          <div className="cw-master-meta-grid">
            <MetaField label="Status" value={resolveMasterArtworkStatusLabel(view.state.status)} />
            <MetaField label="Version" value={view.state.version || versionLabel} />
            <MetaField
              label="Commercial Score"
              value={
                view.state.commercialScore != null
                  ? `${Math.round(view.state.commercialScore)}%`
                  : assets.commercialScore != null
                    ? `${Math.round(assets.commercialScore)}%`
                    : "—"
              }
            />
            <MetaField
              label="Print Readiness"
              value={view.state.printReadiness ?? "—"}
            />
            <MetaField label="Artwork Resolution" value={view.state.resolutionLabel ?? "—"} />
            <MetaField
              label="Transparency"
              value={view.state.transparency ? "Transparent-ready" : "Opaque background"}
            />
            <MetaField label="Placement" value={view.state.placement ?? brief.placement ?? "—"} />
            <MetaField
              label="Print Method"
              value={view.state.printMethod ?? brief.productionMethod ?? "—"}
            />
          </div>

          <div className="cw-master-actions">
            <button
              type="button"
              className="cw-btn cw-btn-primary"
              onClick={onGenerate}
              disabled={Boolean(loading)}
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
              disabled={!exportMarkup}
            >
              <Download className="size-4" />
              Download PNG
            </button>
            <button
              type="button"
              className="cw-btn cw-btn-secondary"
              onClick={() => void handleDownloadSvg()}
              disabled={!exportMarkup}
              title="Vector export — PDF export coming soon"
            >
              <Download className="size-4" />
              Download SVG
            </button>
            <button
              type="button"
              className="cw-btn cw-btn-secondary is-disabled-future"
              disabled
              title="PDF export — coming soon"
            >
              <Download className="size-4" />
              Download PDF
            </button>
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
            <p className="cw-master-approved-note">
              <CheckCircle2 className="size-4" />
              Approved master artwork is locked. Image Studio will use this artwork for hero, mockup,
              lifestyle, campaign, social, and Shopify production.
            </p>
          ) : view.hasArtwork ? (
            <p className="cw-master-hint">
              Approve the master artwork before production handoff to guarantee Image Studio never
              redesigns the creative.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
