"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignMissionState,
  DesignPromptOverrides,
  PipelineStage,
} from "@/lib/design/design-mission-store";
import {
  appendVersionEntry,
  getEffectivePrompts,
  setPipelineStage,
  updateMissionAssets,
  updatePromptOverride,
  updateWorkspace,
} from "@/lib/design/design-mission-store";
import {
  extractGeneratedImageUrl,
  extractGeneratedSvg,
  readGenerationPayload,
  svgMarkupToDataUrl,
} from "@/lib/design/svg-data-url";
import { buildDesignMockupPayload } from "@/lib/design/mockup-request";
import { buildDesignRenderPayload } from "@/lib/design/render-request";
import { sendDesignHandoffToImageStudio, type HandoffSaveResult } from "@/lib/image/image-handoff-store";
import { HandoffDebugOverlay } from "@/components/image/handoff-debug-overlay";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Download,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Shapes,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const PIPELINE_STAGES: Array<{ id: PipelineStage; label: string }> = [
  { id: "research", label: "Research" },
  { id: "design", label: "Design" },
  { id: "image", label: "Image" },
  { id: "mockup", label: "Mockup" },
  { id: "approval", label: "Approval" },
  { id: "shopify", label: "Shopify" },
  { id: "launch", label: "Launch" },
];

interface DesignLabWorkspaceProps {
  mission: DesignMissionState;
  onSelectBrief?: (designId: string) => void;
  onSaveDraft?: () => void;
  onPatchMission: (updater: (state: DesignMissionState) => DesignMissionState) => void;
  commerceSection?: ReactNode;
}

export function DesignLabWorkspace({
  mission,
  onSelectBrief,
  onSaveDraft,
  onPatchMission,
  commerceSection,
}: DesignLabWorkspaceProps) {
  const { brief } = mission;
  const router = useRouter();
  const prompts = useMemo(
    () => getEffectivePrompts(brief, mission.promptOverrides, mission.assets),
    [brief, mission.promptOverrides, mission.assets],
  );

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewFocus, setPreviewFocus] = useState<"svg" | "mockup" | "render" | null>(null);
  const [handoffSendDebug, setHandoffSendDebug] = useState<HandoffSaveResult | null>(null);

  const resetProductionStatus = useCallback(
    (itemId: "svg" | "mockup" | "aiRender") => {
      onPatchMission((s) =>
        updateWorkspace(s, s.brief.designId, (w) => ({
          ...w,
          production: w.production.map((p) =>
            p.id === itemId ? { ...p, status: "pending" as const } : p,
          ),
        })),
      );
    },
    [onPatchMission],
  );

  const runSvgGeneration = useCallback(async () => {
    const label = "Generate SVG";
    setActionLoading(label);
    setActionMessage(null);
    setActionError(null);
    onPatchMission((s) =>
      updateWorkspace(s, s.brief.designId, (w) => ({
        ...w,
        production: w.production.map((p) =>
          p.id === "svg" ? { ...p, status: "working" as const } : p,
        ),
      })),
    );

    try {
      const res = await fetch("/api/design/generate-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const payload = await readGenerationPayload(res);
      if (!res.ok) {
        const err =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? "")
            : "";
        throw new Error(err || "SVG generation failed");
      }

      const svgMarkup = extractGeneratedSvg(payload);
      const svgUrl = svgMarkupToDataUrl(svgMarkup);

      onPatchMission((state) => {
        let next = setPipelineStage(state, "design");
        next = updateMissionAssets(next, { svgUrl, svgMarkup });
        next = appendVersionEntry(next, "SVG generated", "svg");
        return next;
      });

      setPreviewFocus("svg");
      setActionMessage(`${label} complete`);
    } catch (err) {
      resetProductionStatus("svg");
      setActionError(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setActionLoading(null);
    }
  }, [brief, onPatchMission, resetProductionStatus]);

  const runGeneration = useCallback(
    async (
      prompt: string,
      label: string,
      assetKey: "svgUrl" | "mockupUrl" | "renderUrl",
      versionLabel: string,
      versionType: "svg" | "mockup" | "render",
      nextStage: PipelineStage,
    ) => {
      const productionId =
        assetKey === "mockupUrl" ? "mockup" : assetKey === "renderUrl" ? "aiRender" : "svg";

      setActionLoading(label);
      setActionMessage(null);
      setActionError(null);
      onPatchMission((s) =>
        updateWorkspace(s, s.brief.designId, (w) => ({
          ...w,
          production: w.production.map((p) =>
            p.id === productionId ? { ...p, status: "working" as const } : p,
          ),
        })),
      );

      try {
        const isMockup = assetKey === "mockupUrl";
        const isRender = assetKey === "renderUrl";
        const requestBody = isMockup
          ? buildDesignMockupPayload({
              brief,
              collectionName: mission.collectionName,
              assets: mission.assets,
              mockupPrompt: prompt,
            })
          : isRender
            ? buildDesignRenderPayload({
                brief,
                collectionName: mission.collectionName,
                assets: mission.assets,
                imagePrompt: prompt,
              })
            : { brief: prompt };

        const endpoint = isMockup
          ? "/api/design/generate-mockup"
          : isRender
            ? "/api/design/generate-render"
            : "/api/image/run";

        if (isMockup) {
          console.log("[DESIGN STUDIO] mockup request payload", requestBody);
        }
        if (isRender) {
          console.log("[DESIGN STUDIO] render request payload", requestBody);
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const payload = await readGenerationPayload(res);
        if (!res.ok) {
          const err =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error ?? "")
              : "";
          throw new Error(err || "Generation failed");
        }

        const imageUrl = extractGeneratedImageUrl(payload);

        onPatchMission((state) => {
          let next = setPipelineStage(state, nextStage);
          if (imageUrl) {
            next = updateMissionAssets(next, { [assetKey]: imageUrl });
          }
          next = appendVersionEntry(next, versionLabel, versionType);
          return next;
        });

        if (assetKey === "mockupUrl") setPreviewFocus("mockup");
        if (assetKey === "renderUrl") setPreviewFocus("render");

        setActionMessage(`${label} complete`);
      } catch (err) {
        resetProductionStatus(productionId);
        setActionError(err instanceof Error ? err.message : `${label} failed`);
      } finally {
        setActionLoading(null);
      }
    },
    [brief, mission.assets, mission.collectionName, onPatchMission, resetProductionStatus],
  );

  const handleSendToImageStudio = useCallback(() => {
    const saveResult = sendDesignHandoffToImageStudio({
      title: brief.title,
      collection: mission.collectionName ?? "",
      garment: brief.product,
      colorway: brief.color,
      version: "V1",
      imagePrompt: prompts.imagePrompt,
      mockupPrompt: prompts.mockupPrompt,
      designId: brief.designId,
      reportId: mission.reportId,
      assets: mission.assets,
      aiDesignerConcept: mission.assets.aiDesignerConcept,
      renderPlan: mission.assets.aiDesignerRenderPlan,
      review: mission.assets.aiDesignerReview,
    });
    setHandoffSendDebug(saveResult);
    if (!saveResult.saved) {
      setActionError(saveResult.error ?? "Failed to save Image Studio handoff");
      return;
    }
    console.info("[Design Studio] navigating to Image Studio");
    onPatchMission((s) => setPipelineStage(s, "image"));
    router.push("/agents/image");
  }, [
    brief,
    mission.assets,
    mission.collectionName,
    mission.reportId,
    prompts.imagePrompt,
    prompts.mockupPrompt,
    onPatchMission,
    router,
  ]);

  const handleSaveDraft = useCallback(() => {
    onSaveDraft?.();
    setActionMessage("Draft saved");
    setActionError(null);
  }, [onSaveDraft]);

  const handleExportSvg = useCallback(() => {
    if (mission.assets.svgUrl) {
      const anchor = document.createElement("a");
      anchor.href = mission.assets.svgUrl;
      anchor.download = `${brief.designId}-artwork.svg`;
      anchor.click();
      return;
    }
    const blob = new Blob([prompts.svgPrompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${brief.designId}-svg-prompt.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setActionMessage("SVG prompt exported");
  }, [brief.designId, mission.assets.svgUrl, prompts.svgPrompt]);

  const handlePromptOverride = useCallback(
    (key: keyof DesignPromptOverrides, value: string) => {
      onPatchMission((s) => updatePromptOverride(s, key, value));
    },
    [onPatchMission],
  );

  return (
    <div className="design-lab">
      <DesignLabHero mission={mission} brief={brief} />

      {mission.allBriefs && mission.allBriefs.length > 1 ? (
        <div className="design-lab-collection-tabs">
          {mission.allBriefs.map((item) => (
            <button
              key={item.designId}
              type="button"
              className={cn(
                "design-lab-collection-tab",
                item.designId === brief.designId && "design-lab-collection-tab-active",
              )}
              onClick={() => onSelectBrief?.(item.designId)}
            >
              {item.title}
            </button>
          ))}
        </div>
      ) : null}

      <DesignLabPreview mission={mission} brief={brief} previewFocus={previewFocus} />

      <DesignLabBriefCards brief={brief} />

      <DesignLabPrompts
        prompts={prompts}
        onCopy={(text) => {
          void navigator.clipboard.writeText(text);
          setActionMessage("Copied to clipboard");
        }}
        onEdit={handlePromptOverride}
        onRegenerate={(key) => {
          const map = {
            svgPrompt: () => void runSvgGeneration(),
            mockupPrompt: () =>
              void runGeneration(
                prompts.mockupPrompt,
                "Mockup",
                "mockupUrl",
                "Mockup generated",
                "mockup",
                "mockup",
              ),
            imagePrompt: () =>
              void runGeneration(
                prompts.imagePrompt,
                "AI render",
                "renderUrl",
                "AI product render",
                "render",
                "image",
              ),
            designerPrompt: () => {
              setActionMessage("Designer prompt ready for edit");
            },
          };
          map[key]();
        }}
      />

      <DesignLabGeneration
        loading={actionLoading}
        message={actionMessage}
        error={actionError}
        reportId={mission.reportId}
        onGenerateSvg={() => void runSvgGeneration()}
        onGenerateMockup={() =>
          void runGeneration(
            prompts.mockupPrompt,
            "Generate Mockup",
            "mockupUrl",
            "Mockup generated",
            "mockup",
            "mockup",
          )
        }
        onGenerateRender={() =>
          void runGeneration(
            prompts.imagePrompt,
            "Generate AI Product Render",
            "renderUrl",
            "AI product render",
            "render",
            "image",
          )
        }
        onSendToImageStudio={handleSendToImageStudio}
        onExportSvg={handleExportSvg}
        onSaveDraft={handleSaveDraft}
      />

      <DesignLabPipeline currentStage={mission.pipelineStage} />

      <DesignLabVersionHistory entries={mission.versionHistory} />

      {commerceSection ? (
        <DesignLabCollapse
          title="Commerce Intelligence"
          meta="Supporting context — catalog, sales & opportunities"
          defaultOpen={false}
        >
          {commerceSection}
        </DesignLabCollapse>
      ) : null}

      {handoffSendDebug ? (
        <HandoffDebugOverlay
          title="Design Studio — Handoff Send"
          rows={[
            { label: "handoff saved", value: handoffSendDebug.saved ? "yes" : "no" },
            { label: "storage key", value: handoffSendDebug.storageKey },
            { label: "localStorage", value: handoffSendDebug.localStorage ? "yes" : "no" },
            { label: "sessionStorage", value: handoffSendDebug.sessionStorage ? "yes" : "no" },
            { label: "window.name", value: handoffSendDebug.windowName ? "yes" : "no" },
            { label: "title", value: handoffSendDebug.title },
            { label: "collection", value: handoffSendDebug.collection },
            { label: "garment", value: handoffSendDebug.garment },
            { label: "colorway", value: handoffSendDebug.colorway },
            { label: "brief length", value: String(handoffSendDebug.briefLength) },
            { label: "prompt length", value: String(handoffSendDebug.promptLength) },
            ...(handoffSendDebug.error
              ? [{ label: "error", value: handoffSendDebug.error }]
              : []),
          ]}
        />
      ) : null}
    </div>
  );
}

export function DesignLabEmptyState() {
  return (
    <section className="design-lab-empty" aria-label="No active design">
      <div className="design-lab-empty-canvas">
        <CanvasPlaceholder />
      </div>
      <div className="design-lab-empty-copy">
        <p className="design-lab-eyebrow">Creative Director</p>
        <h1>No design selected</h1>
        <p>
          Send a concept from{" "}
          <Link href="/facility/reports">Reports Center</Link> to begin creating.
        </p>
      </div>
    </section>
  );
}

function DesignLabHero({
  mission,
  brief,
}: {
  mission: DesignMissionState;
  brief: DesignStudioBrief;
}) {
  return (
    <section className="design-lab-hero" aria-label="Active Design Mission">
      <div className="design-lab-hero-main">
        <p className="design-lab-eyebrow">Active Design Mission</p>
        <h1 className="design-lab-hero-title">{brief.title}</h1>
        <div className="design-lab-hero-meta">
          {mission.collectionName ? (
            <span className="design-lab-hero-chip">{mission.collectionName}</span>
          ) : null}
          <span className="design-lab-hero-chip">{brief.role}</span>
          <span className="design-lab-hero-chip">{brief.product}</span>
          <span className="design-lab-hero-chip">{brief.color}</span>
        </div>
      </div>
      <div className="design-lab-hero-scores">
        {brief.dnaScore !== undefined ? (
          <HeroScore label="DNA" value={`${brief.dnaScore}%`} accent />
        ) : null}
        {brief.commercialScore !== undefined ? (
          <HeroScore label="Commercial" value={`${brief.commercialScore}%`} />
        ) : null}
        {brief.campaignPotential ? (
          <HeroScore label="Campaign" value={brief.campaignPotential} capitalize />
        ) : null}
        <HeroScore label="Print Ready" value={`${brief.printReadinessScore}%`} />
      </div>
    </section>
  );
}

function HeroScore({
  label,
  value,
  accent = false,
  capitalize = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className={cn("design-lab-hero-score", accent && "design-lab-hero-score-accent")}>
      <span className="design-lab-hero-score-label">{label}</span>
      <span className={cn("design-lab-hero-score-value", capitalize && "capitalize")}>
        {value}
      </span>
    </div>
  );
}

function DesignLabPreview({
  mission,
  brief,
  previewFocus,
}: {
  mission: DesignMissionState;
  brief: DesignStudioBrief;
  previewFocus?: "svg" | "mockup" | "render" | null;
}) {
  const focusedUrl =
    previewFocus === "svg"
      ? mission.assets.svgUrl
      : previewFocus === "mockup"
        ? mission.assets.mockupUrl
        : previewFocus === "render"
          ? mission.assets.renderUrl
          : null;

  const previewUrl =
    focusedUrl ??
    mission.assets.mockupUrl ??
    mission.assets.svgUrl ??
    mission.assets.renderUrl;
  const previewKind = focusedUrl
    ? previewFocus
    : mission.assets.mockupUrl
      ? "mockup"
      : mission.assets.svgUrl
        ? "svg"
        : mission.assets.renderUrl
          ? "render"
          : null;

  return (
    <section className="design-lab-preview" aria-label="Design Preview">
      <div className="design-lab-canvas-wrap">
        <div className="design-lab-canvas">
          {previewUrl ? (
            <>
              <span className="design-lab-canvas-badge">{previewKind}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={`${brief.title} preview`}
                className="design-lab-canvas-image"
              />
            </>
          ) : (
            <div className="design-lab-canvas-placeholder">
              <CanvasPlaceholder />
              <p className="design-lab-canvas-ready">Ready to generate.</p>
            </div>
          )}
        </div>
      </div>

      <aside className="design-lab-specs" aria-label="Quick Specs">
        <h2 className="design-lab-specs-title">Quick Specs</h2>
        <div className="design-lab-specs-grid">
          <SpecCard label="Product" value={brief.product} />
          <SpecCard label="Color" value={brief.color} />
          <SpecCard label="Placement" value={brief.placement} />
          <SpecCard label="Dimensions" value={brief.dimensions} />
          <SpecCard label="Production" value={`${brief.printArea} · ${brief.dimensions}`} />
          <SpecCard label="Material" value={brief.materialEffects} />
          <SpecCard label="Collection" value={mission.collectionName ?? "—"} />
          <SpecCard label="Mood" value={mission.collectionMood ?? "—"} />
          <SpecCard label="Print Method" value={brief.productionMethod} />
        </div>
      </aside>
    </section>
  );
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="design-lab-spec-card">
      <span className="design-lab-spec-label">{label}</span>
      <span className="design-lab-spec-value">{value}</span>
    </div>
  );
}

function DesignLabBriefCards({ brief }: { brief: DesignStudioBrief }) {
  const cards = [
    { id: "visual", title: "Visual Concept", content: brief.visualConcept },
    { id: "story", title: "Design Story", content: brief.designDescription },
    {
      id: "instructions",
      title: "Designer Instructions",
      content: brief.designerInstructions,
      list: true,
    },
    { id: "geometry", title: "Geometry", content: brief.geometry },
    { id: "placement", title: "Placement Strategy", content: brief.placement },
    { id: "materials", title: "Materials", content: brief.materialEffects },
    { id: "typography", title: "Typography", content: brief.typography },
    {
      id: "palette",
      title: "Color Palette",
      content: brief.colorPalette.map((c) => `${c.name} — ${c.usage}`),
      list: true,
    },
    {
      id: "elements",
      title: "Visual Elements",
      content: brief.visualElements,
      chips: true,
    },
  ];

  return (
    <section className="design-lab-brief" aria-label="Design Brief">
      <header className="design-lab-section-header">
        <h2>Design Brief</h2>
        <span>Expand only what you need</span>
      </header>
      <div className="design-lab-brief-cards">
        {cards.map((card) => (
          <DesignLabCollapse key={card.id} title={card.title} defaultOpen={false}>
            {card.chips && Array.isArray(card.content) ? (
              <div className="design-lab-chip-row">
                {card.content.map((item) => (
                  <span key={item} className="design-lab-chip">
                    {item}
                  </span>
                ))}
              </div>
            ) : card.list && Array.isArray(card.content) ? (
              <ul className="design-lab-brief-list">
                {card.content.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="design-lab-brief-text">
                {Array.isArray(card.content) ? card.content.join(", ") : card.content}
              </p>
            )}
          </DesignLabCollapse>
        ))}
      </div>
    </section>
  );
}

function DesignLabPrompts({
  prompts,
  onCopy,
  onEdit,
  onRegenerate,
}: {
  prompts: ReturnType<typeof getEffectivePrompts>;
  onCopy: (text: string) => void;
  onEdit: (key: keyof DesignPromptOverrides, value: string) => void;
  onRegenerate: (key: keyof DesignPromptOverrides) => void;
}) {
  const items: Array<{
    key: keyof DesignPromptOverrides;
    title: string;
    value: string;
  }> = [
    { key: "svgPrompt", title: "SVG Prompt", value: prompts.svgPrompt },
    { key: "mockupPrompt", title: "Mockup Prompt", value: prompts.mockupPrompt },
    { key: "imagePrompt", title: "Image Prompt", value: prompts.imagePrompt },
    {
      key: "designerPrompt",
      title: "Designer Prompt",
      value: prompts.designerPrompt,
    },
  ];

  return (
    <section className="design-lab-prompts" aria-label="Technical prompts">
      <header className="design-lab-section-header">
        <h2>Technical Prompts</h2>
        <span>Hidden by default</span>
      </header>
      <div className="design-lab-prompt-list">
        {items.map((item) => (
          <PromptAccordion
            key={item.key}
            title={item.title}
            value={item.value}
            onCopy={() => onCopy(item.value)}
            onEdit={(v) => onEdit(item.key, v)}
            onRegenerate={() => onRegenerate(item.key)}
          />
        ))}
      </div>
    </section>
  );
}

function PromptAccordion({
  title,
  value,
  onCopy,
  onEdit,
  onRegenerate,
}: {
  title: string;
  value: string;
  onCopy: () => void;
  onEdit: (value: string) => void;
  onRegenerate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <div className={cn("design-lab-prompt-item", open && "design-lab-prompt-item-open")}>
      <button
        type="button"
        className="design-lab-prompt-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <ChevronDown className="size-4" />
      </button>
      {open ? (
        <div className="design-lab-prompt-body">
          {editing ? (
            <textarea
              className="design-lab-prompt-editor"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
            />
          ) : (
            <p className="design-lab-prompt-text">{value}</p>
          )}
          <div className="design-lab-prompt-actions">
            <button type="button" onClick={onCopy}>
              <Copy className="size-3.5" /> Copy
            </button>
            <button
              type="button"
              onClick={() => {
                if (editing) {
                  onEdit(draft);
                  setEditing(false);
                } else {
                  setDraft(value);
                  setEditing(true);
                }
              }}
            >
              {editing ? (
                <>
                  <Check className="size-3.5" /> Save
                </>
              ) : (
                <>
                  <Pencil className="size-3.5" /> Edit
                </>
              )}
            </button>
            <button type="button" onClick={onRegenerate}>
              <RefreshCw className="size-3.5" /> Regenerate
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesignLabGeneration({
  loading,
  message,
  error,
  reportId,
  onGenerateSvg,
  onGenerateMockup,
  onGenerateRender,
  onSendToImageStudio,
  onExportSvg,
  onSaveDraft,
}: {
  loading: string | null;
  message: string | null;
  error: string | null;
  reportId: string;
  onGenerateSvg: () => void;
  onGenerateMockup: () => void;
  onGenerateRender: () => void;
  onSendToImageStudio: () => void;
  onExportSvg: () => void;
  onSaveDraft: () => void;
}) {
  return (
    <section className="design-lab-generation" aria-label="AI Generation">
      <header className="design-lab-section-header">
        <h2>AI Generation</h2>
        <span>Production actions</span>
      </header>
      <div className="design-lab-generation-grid">
        <GenButton
          icon={Shapes}
          label="Generate SVG"
          loading={loading === "Generate SVG"}
          onClick={onGenerateSvg}
          primary
        />
        <GenButton
          icon={ImageIcon}
          label="Generate Mockup"
          loading={loading === "Generate Mockup"}
          onClick={onGenerateMockup}
          primary
        />
        <GenButton
          icon={Wand2}
          label="Generate AI Product Render"
          loading={loading === "Generate AI Product Render"}
          onClick={onGenerateRender}
        />
        <GenButton icon={Send} label="Send to Image Studio" onClick={onSendToImageStudio} />
        <GenButton icon={Download} label="Export SVG" onClick={onExportSvg} />
        <GenButton icon={Save} label="Save Draft" onClick={onSaveDraft} />
        <Link
          href={`/facility/reports?report=${reportId}`}
          className="design-lab-gen-btn design-lab-gen-btn-link"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Research</span>
        </Link>
      </div>
      {message ? <p className="design-lab-gen-message">{message}</p> : null}
      {error ? <p className="design-lab-gen-error">{error}</p> : null}
    </section>
  );
}

function GenButton({
  icon: Icon,
  label,
  onClick,
  loading = false,
  primary = false,
}: {
  icon: typeof Shapes;
  label: string;
  onClick: () => void;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("design-lab-gen-btn", primary && "design-lab-gen-btn-primary")}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      <span>{label}</span>
    </button>
  );
}

function DesignLabPipeline({ currentStage }: { currentStage: PipelineStage }) {
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.id === currentStage);

  return (
    <section className="design-lab-pipeline" aria-label="Progress pipeline">
      <header className="design-lab-section-header">
        <h2>Progress Pipeline</h2>
      </header>
      <ol className="design-lab-pipeline-track">
        {PIPELINE_STAGES.map((stage, index) => {
          const isPast = index < currentIndex;
          const isCurrent = stage.id === currentStage;
          return (
            <li
              key={stage.id}
              className={cn(
                "design-lab-pipeline-step",
                isPast && "design-lab-pipeline-step-done",
                isCurrent && "design-lab-pipeline-step-current",
              )}
            >
              <span className="design-lab-pipeline-dot" />
              <span className="design-lab-pipeline-label">{stage.label}</span>
              {index < PIPELINE_STAGES.length - 1 ? (
                <span className="design-lab-pipeline-connector" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DesignLabVersionHistory({
  entries,
}: {
  entries: DesignMissionState["versionHistory"];
}) {
  return (
    <section className="design-lab-history" aria-label="Version history">
      <header className="design-lab-section-header">
        <h2>Version History</h2>
      </header>
      <ul className="design-lab-history-list">
        {entries.map((entry) => (
          <li key={entry.id} className="design-lab-history-item">
            <div className="design-lab-history-icon">
              <Sparkles className="size-3.5" />
            </div>
            <div className="design-lab-history-copy">
              <span className="design-lab-history-label">{entry.label}</span>
              <time className="design-lab-history-time">
                {formatTimestamp(entry.timestamp)}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DesignLabCollapse({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("design-lab-collapse", open && "design-lab-collapse-open")}>
      <button
        type="button"
        className="design-lab-collapse-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <span className="design-lab-collapse-title">{title}</span>
          {meta ? <span className="design-lab-collapse-meta">{meta}</span> : null}
        </div>
        <ChevronDown className="design-lab-collapse-chevron size-4" />
      </button>
      {open ? <div className="design-lab-collapse-content">{children}</div> : null}
    </div>
  );
}

function CanvasPlaceholder() {
  return (
    <svg
      className="design-lab-placeholder-art"
      viewBox="0 0 320 380"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M80 90 L160 55 L240 90 L260 120 L240 340 L80 340 L60 120 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.35"
      />
      <path
        d="M120 90 C120 70 200 70 200 90"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.25"
      />
      <rect
        x="130"
        y="155"
        width="60"
        height="70"
        rx="4"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.4"
      />
      <circle cx="160" cy="190" r="12" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
    </svg>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
