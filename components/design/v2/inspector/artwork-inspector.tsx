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
import type { ArtworkDisplayName } from "@/lib/design/artwork-display-name";
import type { DesignArtworkTransferDiagnostic } from "@/lib/design/design-to-image-handoff";

interface ArtworkInspectorProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  preview: ArtworkPreviewSource | null;
  artworkIdentity?: ArtworkDisplayName | null;
  validation: ArtworkValidationResult;
  analysis: ArtworkAnalysisResult;
  missionView?: MasterArtworkViewModel | null;
  canApprove: boolean;
  isApproved: boolean;
  onApprove: () => void | Promise<void>;
  approvalBusy?: boolean;
  approvalError?: string | null;
  canContinueToImageStudio?: boolean;
  handoffBusy?: boolean;
  handoffError?: string | null;
  transferDiagnostic?: DesignArtworkTransferDiagnostic | null;
  onContinueToImageStudio?: () => void;
}

function PlaceholderValue({ children }: { children: React.ReactNode }) {
  return <p className="dsv2-inspector-placeholder">{children}</p>;
}

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display =
    typeof value === "boolean" ? (value ? "Ja" : "Nein") : value != null ? String(value) : "—";

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
  artworkIdentity,
  validation,
  analysis,
  missionView,
  canApprove,
  isApproved,
  onApprove,
  approvalBusy = false,
  approvalError = null,
  canContinueToImageStudio = false,
  handoffBusy = false,
  handoffError = null,
  transferDiagnostic = null,
  onContinueToImageStudio,
}: ArtworkInspectorProps) {
  const state = missionView?.state;
  const metadata = validation.metadata;
  const hasUpload = Boolean(metadata);
  const isLocalUpload = preview?.source === "upload";
  const analysisReady = analysis.status === "complete" || analysis.status === "unavailable";

  return (
    <aside
      className={cn("dsv2-inspector", collapsed && "is-collapsed")}
      aria-label="Artwork-Prüfung"
    >
      <div className="dsv2-inspector-head">
        {!collapsed ? <span className="dsv2-inspector-label">Prüfung</span> : null}
        <button
          type="button"
          className="dsv2-inspector-collapse"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Prüfung öffnen" : "Prüfung einklappen"}
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
            title="Dateiinformationen"
            icon={FileText}
            defaultOpen
          >
            {hasUpload && metadata ? (
              <dl className="dsv2-info-list">
                <InfoRow label="Artwork" value={artworkIdentity?.displayName} />
                <InfoRow label="Dateiname" value={metadata.fileName} />
                {artworkIdentity?.provenanceLabel ? (
                  <InfoRow label="Herkunft" value={artworkIdentity.provenanceLabel.replace(/^Herkunft:\s*/, "")} />
                ) : null}
                <InfoRow label="Dateityp" value={formatFileKindLabel(metadata.fileKind)} />
                <InfoRow label="Dateigröße" value={formatBytes(metadata.fileSize)} />
                <InfoRow label="Abmessungen" value={metadata.dimensionsLabel} />
                <InfoRow
                  label="Transparenz"
                  value={
                    metadata.hasTransparency == null
                      ? "—"
                      : metadata.hasTransparency
                        ? "Erkannt"
                        : "Nicht erkannt"
                  }
                />
                <InfoRow
                  label="Geschätzte DPI"
                  value={metadata.estimatedDpi ? `${metadata.estimatedDpi} DPI` : "—"}
                />
                <InfoRow label="Seitenverhältnis" value={metadata.aspectRatioLabel} />
                <InfoRow
                  label="Hochgeladen"
                  value={new Date(metadata.uploadedAt).toLocaleString("de-DE")}
                />
                <InfoRow
                  label="Vorschau"
                  value={metadata.previewSupported ? "Verfügbar" : "Nicht verfügbar"}
                />
                {metadata.printSizeAt300Dpi ? (
                  <InfoRow label="Druckgröße" value={metadata.printSizeAt300Dpi} />
                ) : null}
              </dl>
            ) : preview && !isLocalUpload ? (
              <dl className="dsv2-info-list">
                <InfoRow label="Artwork" value={artworkIdentity?.displayName ?? preview.fileName} />
                <InfoRow label="Dateityp" value={preview.mimeType} />
                <InfoRow
                  label="Herkunft"
                  value={artworkIdentity?.provenanceLabel?.replace(/^Herkunft:\s*/, "") ?? "Design Studio"}
                />
                <InfoRow label="Version" value={state?.version} />
              </dl>
            ) : (
              <PlaceholderValue>Lade ein Artwork hoch, um die Dateiinformationen zu sehen.</PlaceholderValue>
            )}
          </CollapsibleInspectorSection>

          <details className="nx-technical dsv2-analysis-details">
            <summary>Erweiterte Artwork-Analyse</summary>
            <div className="nx-technical__body">
          <CollapsibleInspectorSection
            id="dsv2-artwork-analysis"
            title="Artwork-Analyse"
            icon={Sparkles}
            defaultOpen
          >
            <ArtworkAnalysisOverview analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-typography" title="Typografie" icon={Type} defaultOpen>
            <TypographyAnalysisPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-color" title="Farbpalette" icon={Palette} defaultOpen>
            <ColorPalettePanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-composition" title="Komposition" icon={Layers}>
            <CompositionPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-print-area" title="Druckbereich" icon={Layers}>
            <PrintAnalysisPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-print-size" title="Druckgröße" icon={Printer}>
            <PrintAnalysisPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-production" title="Produktion" icon={Briefcase}>
            {analysisReady ? (
              <div className="dsv2-info-list dsv2-info-list--flat">
                <InfoRow label="Komplexität" value={analysis.creative.complexity} />
                <InfoRow
                  label="Fertigung"
                  value={`${analysis.creative.manufacturingComplexity}/100`}
                />
                <InfoRow
                  label="Produktionsrisiko"
                  value={`${analysis.commercial.productionRisk}/100`}
                />
              </div>
            ) : (
              <PlaceholderValue>Produktionsanalyse steht noch aus.</PlaceholderValue>
            )}
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection
            id="dsv2-commercial"
            title="Kommerzielle Prüfung"
            icon={Shield}
            defaultOpen
          >
            <CommercialAnalysisPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-brand-dna" title="Marken-DNA" icon={Droplets} defaultOpen>
            <BrandDnaPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-audience" title="Zielgruppe & Story" icon={Users}>
            <CreativeInsightsPanel analysis={analysis} />
          </CollapsibleInspectorSection>

          <CollapsibleInspectorSection id="dsv2-suggestions" title="Vorschläge" icon={Lightbulb}>
            <SuggestionsPanel analysis={analysis} />
          </CollapsibleInspectorSection>
            </div>
          </details>

          <CollapsibleInspectorSection
            id="dsv2-approval"
            title="Freigabe"
            icon={CheckCircle2}
            defaultOpen
          >
            <div className="dsv2-approval-panel">
              {isApproved ? (
                <>
                  <p className="dsv2-validation-ok">
                    Artwork freigegeben — bereit für das Image Studio.
                  </p>
                  {canContinueToImageStudio && onContinueToImageStudio ? (
                    <button
                      type="button"
                      className="dsv2-approve-btn dsv2-continue-btn"
                      onClick={onContinueToImageStudio}
                      disabled={handoffBusy}
                    >
                      {handoffBusy ? "Übergabe läuft…" : "Im Image Studio verwenden"}
                    </button>
                  ) : null}
                  {handoffError ? (
                    <p className="dsv2-workflow-error" role="alert">
                      {handoffError}
                    </p>
                  ) : null}
                  {handoffError && transferDiagnostic && process.env.NODE_ENV !== "production" ? (
                    <TransferDiagnosticDetails diagnostic={transferDiagnostic} />
                  ) : null}
                </>
              ) : (
                <>
                  <p className="dsv2-inspector-placeholder">
                    {validation.status === "invalid"
                      ? "Behebe die Validierungsfehler vor der Freigabe."
                      : validation.status === "checking" || analysis.status === "analyzing"
                        ? "Validierung und Analyse werden abgeschlossen."
                        : !hasUpload
                          ? "Lade ein Artwork hoch und prüfe es vor der Freigabe."
                          : !analysisReady
                            ? "Die Analyse muss vor der Freigabe abgeschlossen sein."
                            : "Gib das Artwork frei, wenn es produktionsbereit ist."}
                  </p>
                  <button
                    type="button"
                    className="dsv2-approve-btn"
                    disabled={!canApprove || approvalBusy}
                    onClick={() => void onApprove()}
                  >
                    {approvalBusy ? "Freigabe wird gespeichert…" : "Artwork freigeben"}
                  </button>
                  {approvalError ? (
                    <p className="dsv2-workflow-error" role="alert">
                      {approvalError}
                    </p>
                  ) : null}
                  {approvalError && transferDiagnostic && process.env.NODE_ENV !== "production" ? (
                    <TransferDiagnosticDetails diagnostic={transferDiagnostic} />
                  ) : null}
                </>
              )}
            </div>
          </CollapsibleInspectorSection>
        </div>
      ) : null}
    </aside>
  );
}

function TransferDiagnosticDetails({
  diagnostic,
}: {
  diagnostic: DesignArtworkTransferDiagnostic;
}) {
  return (
    <details className="dsv2-technical-error">
      <summary>Technische Fehlerdetails</summary>
      <dl>
        <InfoRow label="Vorgang" value={diagnostic.operation} />
        <InfoRow label="Status" value={diagnostic.status} />
        <InfoRow label="Code" value={diagnostic.code} />
        <InfoRow label="Request-ID" value={diagnostic.requestId} />
        <InfoRow label="Artwork-ID" value={diagnostic.artworkId} />
        <InfoRow label="Design-ID" value={diagnostic.designId} />
        <InfoRow label="Version" value={diagnostic.version} />
        <InfoRow label="Erwartete Bytes" value={diagnostic.expectedByteLength} />
        <InfoRow label="Empfangene Bytes" value={diagnostic.receivedByteLength} />
        <InfoRow label="Ursache" value={diagnostic.message} />
      </dl>
    </details>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
