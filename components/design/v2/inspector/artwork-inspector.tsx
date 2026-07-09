"use client";

import { CollapsibleInspectorSection } from "@/components/design/collapsible-inspector-section";
import {
  ArtworkAnalysisOverview,
  BrandDnaPanel,
  ColorPalettePanel,
  CommercialAnalysisPanel,
  CompositionPanel,
  CreativeInsightsPanel,
  PrintAnalysisPanel,
  SuggestionsPanel,
  TypographyAnalysisPanel,
} from "@/components/design/v2/inspector/analysis-panels";
import { ValidationSummary } from "@/components/design/v2/inspector/validation-status";
import type { ArtworkAnalysisResult } from "@/lib/design/artwork-analysis";
import type { ArtworkValidationResult } from "@/lib/design/artwork-validation";
import { formatFileKindLabel } from "@/lib/design/artwork-validation";
import type { MasterArtworkViewModel } from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  Droplets,
  FileText,
  Layers,
  Lightbulb,
  Palette,
  Printer,
  Shield,
  Sparkles,
  Type,
  Users,
} from "lucide-react";
import type { ArtworkPreviewSource } from "../types";

interface ArtworkInspectorProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  preview: ArtworkPreviewSource | null;
  validation: ArtworkValidationResult;
  analysis: ArtworkAnalysisResult;
  missionView?: MasterArtworkViewModel | null;
  canApprove: boolean;
  isApproved: boolean;
  onApprove: () => void;
}

function PlaceholderValue({ children }: { children: React.ReactNode }) {
  return <p className="dsv2-inspector-placeholder">{children}</p>;
}

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display =
    typeof value === "boolean" ? (value ? "Yes" : "No") : value != null ? String(value) : "—";

  return (
    <div className="dsv2-info-row">
      <dt>{label}</dt>
      <dd>{display}</dd>
    </div>
  );
}

export function ArtworkInspector({
  collapsed,
  onCollapsedChange,
  preview,
  validation,
  analysis,
  missionView,
  canApprove,
  isApproved,
  onApprove,
}: ArtworkInspectorProps) {
  const state = missionView?.state;
  const metadata = validation.metadata;
  const hasUpload = Boolean(metadata);
  const isLocalUpload = preview?.source === "upload";
  const analysisReady = analysis.status === "complete" || analysis.status === "unavailable";

  return (
    <aside
      className={cn("dsv2-inspector", collapsed && "is-collapsed")}
      aria-label="Artwork analysis"
    >
      <div className="dsv2-inspector-head">
        {!collapsed ? <span className="dsv2-inspector-label">Inspector</span> : null}
        <button
          type="button"
          className="dsv2-inspector-collapse"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expand inspector" : "Collapse inspector"}
        >
          <ChevronLeft className={cn("size-4", !collapsed && "is-flipped")} />
        </button>
      </div>

      {!collapsed ? (
        <div className="dsv2-inspector-scroll">
          <div className="dsv2-inspector-validation-banner">
            <ValidationSummary validation={validation} />
          </div>

          <CollapsibleInspectorSection
            id="dsv2-file-info"
            title="File Information"
            icon={FileText}
            defaultOpen
          >
            {hasUpload && metadata ? (
              <dl className="dsv2-info-list">
                <InfoRow label="File name" value={metadata.fileName} />
                <InfoRow label="File type" value={formatFileKindLabel(metadata.fileKind)} />
                <InfoRow label="File size" value={formatBytes(metadata.fileSize)} />
                <InfoRow label="Dimensions" value={metadata.dimensionsLabel} />
                <InfoRow
                  label="Transparency"
                  value={
                    metadata.hasTransparency == null
                      ? "—"
                      : metadata.hasTransparency
                        ? "Detected"
                        : "Not detected"
                  }
                />
                <InfoRow
                  label="Estimated DPI"
                  value={metadata.estimatedDpi ? `${metadata.estimatedDpi} DPI` : "—"}
                />
                <InfoRow label="Aspect ratio" value={metadata.aspectRatioLabel} />
                <InfoRow
                  label="Upload time"
                  value={new Date(metadata.uploadedAt).toLocaleString()}
                />
                <InfoRow
                  label="Preview support"
                  value={metadata.previewSupported ? "Yes" : "No"}
                />
                {metadata.printSizeAt300Dpi ? (
                  <InfoRow label="Print size" value={metadata.printSizeAt300Dpi} />
                ) : null}
              </dl>
            ) : preview && !isLocalUpload ? (
              <dl className="dsv2-info-list">
                <InfoRow label="File name" value={preview.fileName} />
                <InfoRow label="File type" value={preview.mimeType} />
                <InfoRow label="Source" value="Mission" />
                <InfoRow label="Version" value={state?.version} />
              </dl>
            ) : (
              <PlaceholderValue>Upload artwork to view file details.</PlaceholderValue>
            )}
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection
            id="dsv2-artwork-analysis"
            title="Artwork Analysis"
            icon={Sparkles}
            defaultOpen
          >
            <ArtworkAnalysisOverview analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-typography" title="Typography" icon={Type} defaultOpen>
            <TypographyAnalysisPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-color" title="Color Palette" icon={Palette} defaultOpen>
            <ColorPalettePanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-composition" title="Composition" icon={Layers}>
            <CompositionPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-print-area" title="Print Area" icon={Layers}>
            <PrintAnalysisPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-print-size" title="Print Size" icon={Printer}>
            <PrintAnalysisPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-production" title="Production" icon={Briefcase}>
            {analysisReady ? (
              <div className="dsv2-info-list dsv2-info-list--flat">
                <InfoRow label="Complexity" value={analysis.creative.complexity} />
                <InfoRow
                  label="Manufacturing"
                  value={`${analysis.creative.manufacturingComplexity}/100`}
                />
                <InfoRow
                  label="Production risk"
                  value={`${analysis.commercial.productionRisk}/100`}
                />
              </div>
            ) : (
              <PlaceholderValue>Production analysis pending.</PlaceholderValue>
            )}
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection
            id="dsv2-commercial"
            title="Commercial Review"
            icon={Shield}
            defaultOpen
          >
            <CommercialAnalysisPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-brand-dna" title="Brand DNA" icon={Droplets} defaultOpen>
            <BrandDnaPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-audience" title="Audience & Story" icon={Users}>
            <CreativeInsightsPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-suggestions" title="Suggestions" icon={Lightbulb}>
            <SuggestionsPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection
            id="dsv2-approval"
            title="Approval"
            icon={CheckCircle2}
            defaultOpen
          >
            <div className="dsv2-approval-panel">
              {isApproved ? (
                <p className="dsv2-validation-ok">Artwork approved — ready for Image Studio handoff.</p>
              ) : (
                <>
                  <p className="dsv2-inspector-placeholder">
                    {validation.status === "invalid"
                      ? "Fix validation errors before approving."
                      : validation.status === "checking" || analysis.status === "analyzing"
                        ? "Waiting for validation and analysis to complete."
                        : !hasUpload
                          ? "Upload and validate artwork to enable approval."
                          : !analysisReady
                            ? "Analysis must complete before approval."
                            : "Approve when ready for production handoff."}
                  </p>
                  <button
                    type="button"
                    className="dsv2-approve-btn"
                    disabled={!canApprove}
                    onClick={onApprove}
                  >
                    Approve Artwork
                  </button>
                </>
              )}
            </div>
          </CollapsibleInspectorSection>
        </div>
      ) : null}
    </aside>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
