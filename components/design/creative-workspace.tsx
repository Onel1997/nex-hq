"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { DesignLabCollapse } from "@/components/design/design-lab-workspace";
import type {
  CollectionTimelineStage,
  DesignIteration,
  DesignMissionState,
  DesignPromptOverrides,
  PerDesignWorkspace,
  PipelineStage,
} from "@/lib/design/design-mission-store";
import {
  addChatMessage,
  appendVersionEntry,
  clearCompareMode,
  createNewIteration,
  duplicateIteration,
  getActiveIteration,
  getActiveWorkspace,
  getEffectivePrompts,
  restoreIteration,
  setApprovalStatus,
  setCompareMode,
  setPipelineStage,
  setTimelineStage,
  toggleIterationFavorite,
  updateMissionAssets,
  updatePromptOverride,
  updateWorkspace,
} from "@/lib/design/design-mission-store";
import { svgMarkupToDataUrl } from "@/lib/design/svg-data-url";
import { saveImageStudioHandoff } from "@/lib/image/image-handoff-store";
import { cn } from "@/lib/utils";
import {
  Archive,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Columns2,
  Copy,
  Download,
  Eye,
  GitCompare,
  Heart,
  ImageIcon,
  Loader2,
  Maximize2,
  MessageSquare,
  Minus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Shapes,
  Sparkles,
  Star,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type CanvasTab = "svg" | "mockup" | "render" | "split";
type ZoomLevel = 0.25 | 0.5 | 0.75 | 1 | 1.5 | "fit";

const TIMELINE: Array<{ id: CollectionTimelineStage; label: string }> = [
  { id: "research", label: "Research" },
  { id: "design", label: "Design" },
  { id: "images", label: "Images" },
  { id: "marketing", label: "Marketing" },
  { id: "shopify", label: "Shopify" },
  { id: "launch", label: "Launch" },
];

const DIRECTOR_SUGGESTIONS: Array<{ label: string; prompt: string }> = [
  { label: "Improve luxury feeling", prompt: "Make typography more premium and increase the luxury feeling" },
  { label: "Reduce typography", prompt: "Reduce visual weight and simplify typography" },
  { label: "Increase emotional impact", prompt: "Increase emotional impact and editorial presence" },
  { label: "More editorial", prompt: "Make the composition more editorial and refined" },
  { label: "Create Version 2", prompt: "Create a refined Version 2 with elevated restraint" },
  { label: "Generate alternate composition", prompt: "Generate an alternate composition with fresh layout" },
  { label: "Improve print efficiency", prompt: "Improve print efficiency and production clarity" },
];

interface CreativeWorkspaceProps {
  mission: DesignMissionState;
  onSelectBrief?: (designId: string) => void;
  onSaveDraft?: () => void;
  onPatchMission: (updater: (state: DesignMissionState) => DesignMissionState) => void;
  renderCommerceSection?: () => ReactNode;
}

export function CreativeWorkspace({
  mission,
  onSelectBrief,
  onSaveDraft,
  onPatchMission,
  renderCommerceSection,
}: CreativeWorkspaceProps) {
  const router = useRouter();
  const workspace = getActiveWorkspace(mission);
  const iteration = getActiveIteration(workspace);
  const brief = iteration.brief;
  const prompts = useMemo(
    () => getEffectivePrompts(brief, iteration.promptOverrides),
    [brief, iteration.promptOverrides],
  );

  const [canvasTab, setCanvasTab] = useState<CanvasTab>("mockup");
  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setError(null);
  }, []);

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
    setToast(null);
    setError(null);
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
      const data = (await res.json()) as { ok?: boolean; error?: string; svg?: string };
      if (!res.ok || !data.ok || !data.svg) {
        throw new Error(data.error ?? "SVG generation failed");
      }

      const svgUrl = svgMarkupToDataUrl(data.svg);

      onPatchMission((state) => {
        let next = setPipelineStage(state, "design");
        next = setTimelineStage(next, "design");
        next = updateMissionAssets(next, { svgUrl });
        next = appendVersionEntry(next, "SVG generated", "svg");
        return next;
      });
      setCanvasTab("svg");
      notify("Generate SVG complete");
    } catch (err) {
      resetProductionStatus("svg");
      setError(err instanceof Error ? err.message : "Generate SVG failed");
    } finally {
      setActionLoading(null);
    }
  }, [brief, notify, onPatchMission, resetProductionStatus]);

  const runGeneration = useCallback(
    async (
      prompt: string,
      label: string,
      assetKey: "svgUrl" | "mockupUrl" | "renderUrl",
      versionLabel: string,
      versionType: "svg" | "mockup" | "render",
      pipeline: PipelineStage,
      timeline: CollectionTimelineStage,
    ) => {
      setActionLoading(label);
      setToast(null);
      setError(null);
      onPatchMission((s) =>
        updateWorkspace(s, s.brief.designId, (w) => ({
          ...w,
          production: w.production.map((p) =>
            p.id === (assetKey === "svgUrl" ? "svg" : assetKey === "mockupUrl" ? "mockup" : "aiRender")
              ? { ...p, status: "working" as const }
              : p,
          ),
        })),
      );

      try {
        const res = await fetch("/api/image/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: prompt }),
        });
        const data = (await res.json()) as {
          error?: string;
          imageUrl?: string;
          assets?: Array<{ imageUrl?: string }>;
        };
        if (!res.ok) throw new Error(data.error ?? "Generation failed");

        const imageUrl =
          data.imageUrl ?? data.assets?.find((a) => a.imageUrl)?.imageUrl;

        onPatchMission((state) => {
          let next = setPipelineStage(state, pipeline);
          next = setTimelineStage(next, timeline);
          if (imageUrl) next = updateMissionAssets(next, { [assetKey]: imageUrl });
          next = appendVersionEntry(next, versionLabel, versionType);
          return next;
        });
        notify(`${label} complete`);
      } catch (err) {
        const productionId =
          assetKey === "svgUrl" ? "svg" : assetKey === "mockupUrl" ? "mockup" : "aiRender";
        resetProductionStatus(productionId);
        setError(err instanceof Error ? err.message : `${label} failed`);
      } finally {
        setActionLoading(null);
      }
    },
    [notify, onPatchMission, resetProductionStatus],
  );

  const sendDirectorMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || chatLoading) return;

      setChatLoading(true);
      onPatchMission((s) =>
        addChatMessage(s, {
          id: crypto.randomUUID(),
          role: "user",
          content: trimmed,
          timestamp: new Date().toISOString(),
        }),
      );
      setChatInput("");

      try {
        const res = await fetch("/api/design/creative-director", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, brief }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          response?: string;
          briefPatch?: Partial<DesignStudioBrief>;
          promptPatch?: Partial<DesignPromptOverrides>;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Director unavailable");

        const patchedBrief = { ...brief, ...(data.briefPatch ?? {}) };
        onPatchMission((s) => {
          let next = createNewIteration(
            s,
            patchedBrief,
            `V${Math.max(...getActiveWorkspace(s).iterations.map((i) => i.version), 0) + 1} — AI refinement`,
            "ai",
          );
          if (data.promptPatch) {
            for (const [key, value] of Object.entries(data.promptPatch)) {
              if (value) {
                next = updatePromptOverride(
                  next,
                  key as keyof DesignPromptOverrides,
                  value,
                );
              }
            }
          }
          next = addChatMessage(next, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.response ?? "Design updated.",
            timestamp: new Date().toISOString(),
          });
          return next;
        });
        notify("Creative Director updated the design");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Director failed");
      } finally {
        setChatLoading(false);
      }
    },
    [brief, chatLoading, notify, onPatchMission],
  );

  const compareIterations = mission.compareMode
    ? {
        left: workspace.iterations.find((i) => i.id === mission.compareMode!.leftId),
        right: workspace.iterations.find((i) => i.id === mission.compareMode!.rightId),
      }
    : null;

  return (
    <div className="cw-root">
      <CollectionNavigator
        collectionName={mission.collectionName}
        designs={mission.allBriefs ?? [brief]}
        activeId={brief.designId}
        onSelect={onSelectBrief}
      />

      <div className="cw-main">
        <header className="cw-mission-bar">
          <div className="cw-mission-bar-primary">
            <p className="cw-eyebrow">Active Design Mission</p>
            <h1>{brief.title}</h1>
            <p className="cw-mission-meta">
              {mission.collectionName} · {brief.role} · {brief.product} · {brief.color}
            </p>
            <div className="cw-mission-inline-meta">
              {brief.dnaScore !== undefined ? (
                <ScorePill label="DNA" value={`${brief.dnaScore}%`} />
              ) : null}
              <ScorePill label="Print Ready" value={`${brief.printReadinessScore}%`} />
              <span className="cw-version-badge">{iteration.label}</span>
            </div>
          </div>
        </header>

        <div className="cw-toolbar-sticky">
        <ProductionToolbar
          loading={actionLoading}
          onGenerateSvg={() => void runSvgGeneration()}
          onGenerateMockup={() =>
            void runGeneration(
              prompts.mockupPrompt,
              "Generate Mockup",
              "mockupUrl",
              "Mockup generated",
              "mockup",
              "mockup",
              "images",
            )
          }
          onGenerateRender={() =>
            void runGeneration(
              prompts.imagePrompt,
              "Generate AI Render",
              "renderUrl",
              "AI render",
              "render",
              "image",
              "images",
            )
          }
          onSendImageStudio={() => {
            saveImageStudioHandoff({
              brief: prompts.imagePrompt,
              sourceTitle: brief.title,
              designId: brief.designId,
              reportId: mission.reportId,
              handoffAt: new Date().toISOString(),
            });
            router.push("/agents/image");
          }}
          onExportSvg={() => {
            if (workspace.assets.svgUrl) {
              const a = document.createElement("a");
              a.href = workspace.assets.svgUrl;
              a.download = `${brief.designId}.svg`;
              a.click();
            } else {
              void navigator.clipboard.writeText(prompts.svgPrompt);
              notify("SVG prompt copied");
            }
          }}
          onExportPng={() => {
            const url = workspace.assets.mockupUrl ?? workspace.assets.renderUrl;
            if (url) window.open(url, "_blank");
            else notify("Generate a mockup or render first");
          }}
          onSaveDraft={() => {
            onSaveDraft?.();
            notify("Draft saved");
          }}
        />
        </div>

        <div className="cw-workspace-core">
          <DesignCanvas
            tab={canvasTab}
            onTabChange={setCanvasTab}
            zoom={zoom}
            onZoomChange={setZoom}
            assets={workspace.assets}
            title={brief.title}
          />
        </div>

        <CreativeDirectorPanel
          open={directorOpen}
          onToggleOpen={() => setDirectorOpen((value) => !value)}
          messages={workspace.chat}
          input={chatInput}
          loading={chatLoading}
          onInputChange={setChatInput}
          onSend={() => void sendDirectorMessage(chatInput)}
          onSuggestion={sendDirectorMessage}
        />

        {toast ? <p className="cw-toast">{toast}</p> : null}
        {error ? <p className="cw-error">{error}</p> : null}

        <div className="cw-supporting-stack">
          <IterationsStrip
            iterations={workspace.iterations}
            activeId={workspace.activeIterationId}
            onPreview={(id) => onPatchMission((s) => restoreIteration(s, id))}
            onRestore={(id) => onPatchMission((s) => restoreIteration(s, id))}
            onDuplicate={(id) => onPatchMission((s) => duplicateIteration(s, id))}
            onCompare={(id) => {
              const other =
                workspace.iterations.find((i) => i.id !== id)?.id ?? id;
              onPatchMission((s) => setCompareMode(s, id, other));
            }}
            onFavorite={(id) => onPatchMission((s) => toggleIterationFavorite(s, id))}
          />
          <ProductionStatusPanel items={workspace.production} />
          <DesignHealthPanel health={workspace.health} />
        </div>
      </div>

      <div className="cw-timeline-span">
        <CollectionTimeline current={mission.timelineStage} />
      </div>

      {renderCommerceSection ? (
        <div className="cw-commerce-span">
          <DesignLabCollapse
            title="Commerce Intelligence"
            meta="Supporting context"
            defaultOpen={false}
          >
            {renderCommerceSection()}
          </DesignLabCollapse>
        </div>
      ) : null}

      <QuickApprovalPanel
        onApprove={() => {
          onPatchMission((s) => setApprovalStatus(s, "approved"));
          notify("Design approved");
        }}
        onRevision={() => {
          onPatchMission((s) => setApprovalStatus(s, "revision"));
          notify("Marked for revision");
        }}
        onArchive={() => {
          onPatchMission((s) => setApprovalStatus(s, "archived"));
          notify("Design archived");
        }}
        onBackResearch={() => router.push(`/facility/reports?report=${mission.reportId}`)}
        onImageStudio={() => {
          saveImageStudioHandoff({
            brief: prompts.imagePrompt,
            sourceTitle: brief.title,
            designId: brief.designId,
            reportId: mission.reportId,
            handoffAt: new Date().toISOString(),
          });
          router.push("/agents/image");
        }}
        onCeo={() => router.push("/agents/ceo")}
      />

      {compareIterations?.left && compareIterations.right ? (
        <ComparisonModal
          left={compareIterations.left}
          right={compareIterations.right}
          onClose={() => onPatchMission(clearCompareMode)}
          onUseLeft={() => {
            onPatchMission((s) => restoreIteration(s, compareIterations.left!.id));
            onPatchMission(clearCompareMode);
          }}
          onUseRight={() => {
            onPatchMission((s) => restoreIteration(s, compareIterations.right!.id));
            onPatchMission(clearCompareMode);
          }}
        />
      ) : null}
    </div>
  );
}

export function CreativeWorkspaceEmpty() {
  return (
    <section className="cw-empty">
      <div className="cw-empty-canvas">
        <GarmentPlaceholder />
        <p>Ready to create.</p>
      </div>
      <div>
        <p className="cw-eyebrow">Creative Director Workspace</p>
        <h1>No design selected</h1>
        <p className="cw-empty-copy">
          Send a concept from{" "}
          <Link href="/facility/reports">Reports Center</Link> to enter the lab.
        </p>
      </div>
    </section>
  );
}

function CollectionNavigator({
  collectionName,
  designs,
  activeId,
  onSelect,
}: {
  collectionName?: string;
  designs: DesignStudioBrief[];
  activeId: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <nav className="cw-collection-nav" aria-label="Collection navigator">
      <p className="cw-collection-nav-title">{collectionName ?? "Collection"}</p>
      {designs.length > 1 ? (
        <ul>
          {designs.map((d) => (
            <li key={d.designId}>
              <button
                type="button"
                className={cn("cw-collection-item", d.designId === activeId && "active")}
                onClick={() => onSelect?.(d.designId)}
              >
                <span className="cw-collection-dot" />
                {d.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cw-collection-nav-single">{designs[0]?.title ?? "—"}</p>
      )}
    </nav>
  );
}

function DesignCanvas({
  tab,
  onTabChange,
  zoom,
  onZoomChange,
  assets,
  title,
}: {
  tab: CanvasTab;
  onTabChange: (t: CanvasTab) => void;
  zoom: ZoomLevel;
  onZoomChange: (z: ZoomLevel) => void;
  assets: PerDesignWorkspace["assets"];
  title: string;
}) {
  const tabs: Array<{ id: CanvasTab; label: string }> = [
    { id: "svg", label: "SVG" },
    { id: "mockup", label: "Mockup" },
    { id: "render", label: "AI Render" },
    { id: "split", label: "Split View" },
  ];

  const zoomOptions: ZoomLevel[] = [0.25, 0.5, 0.75, 1, 1.5, "fit"];

  const renderLayer = (kind: "svg" | "mockup" | "render") => {
    const url =
      kind === "svg"
        ? assets.svgUrl
        : kind === "mockup"
          ? assets.mockupUrl
          : assets.renderUrl;
    if (!url) {
      return (
        <div className="cw-canvas-empty">
          <GarmentPlaceholder />
          <p>Ready to create.</p>
        </div>
      );
    }
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={url} alt={`${title} ${kind}`} className="cw-canvas-img" />
    );
  };

  const scale =
    zoom === "fit" ? 1 : zoom;

  return (
    <section className="cw-canvas-section">
      <div className="cw-canvas-toolbar">
        <div className="cw-canvas-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn("cw-canvas-tab", tab === t.id && "active")}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="cw-canvas-zoom">
          <button type="button" onClick={() => onZoomChange(0.5)} aria-label="Zoom out">
            <Minus className="size-3.5" />
          </button>
          {zoomOptions.map((z) => (
            <button
              key={String(z)}
              type="button"
              className={cn(zoom === z && "active")}
              onClick={() => onZoomChange(z)}
            >
              {z === "fit" ? "Fit" : `${z * 100}%`}
            </button>
          ))}
          <button type="button" onClick={() => onZoomChange(1.5)} aria-label="Zoom in">
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="cw-canvas-stage">
        <div className="cw-canvas-atmosphere" aria-hidden>
          <div className="cw-canvas-spotlight" />
          <div className="cw-canvas-particles">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="cw-particle" style={{ "--i": i } as CSSProperties} />
            ))}
          </div>
        </div>
        <div
          className="cw-canvas-viewport"
          style={{
            transform: zoom === "fit" ? undefined : `scale(${scale})`,
          }}
        >
          {tab === "split" ? (
            <div className="cw-canvas-split">
              <div>{renderLayer("svg")}</div>
              <div>{renderLayer("mockup")}</div>
            </div>
          ) : tab === "svg" ? (
            renderLayer("svg")
          ) : tab === "mockup" ? (
            renderLayer("mockup")
          ) : (
            renderLayer("render")
          )}
        </div>
      </div>
    </section>
  );
}

function ProductionToolbar({
  loading,
  onGenerateSvg,
  onGenerateMockup,
  onGenerateRender,
  onSendImageStudio,
  onExportSvg,
  onExportPng,
  onSaveDraft,
}: {
  loading: string | null;
  onGenerateSvg: () => void;
  onGenerateMockup: () => void;
  onGenerateRender: () => void;
  onSendImageStudio: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onSaveDraft: () => void;
}) {
  const generateTools = [
    { label: "Generate SVG", icon: Shapes, action: onGenerateSvg },
    { label: "Generate Mockup", icon: ImageIcon, action: onGenerateMockup },
    { label: "Generate AI Render", icon: Wand2, action: onGenerateRender },
    { label: "Upscale", icon: ZoomIn, action: () => {} },
    { label: "Remove Background", icon: Maximize2, action: () => {} },
  ];

  const exportTools = [
    { label: "Export SVG", icon: Download, action: onExportSvg },
    { label: "Export PNG", icon: Download, action: onExportPng },
    { label: "Export PDF", icon: Download, action: onExportPng },
    { label: "Send to Image Studio", icon: Send, action: onSendImageStudio },
    { label: "Send to Shopify", icon: Send, action: () => {} },
    { label: "Save Draft", icon: Save, action: onSaveDraft },
  ];

  const renderBtn = (
    tool: { label: string; icon: typeof Shapes; action: () => void },
    variant: "primary" | "secondary" | "success" = "secondary",
  ) => (
    <button
      key={tool.label}
      type="button"
      className={cn("cw-toolbar-btn", `cw-btn-${variant}`)}
      disabled={loading === tool.label}
      onClick={tool.action}
    >
      {loading === tool.label ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <tool.icon className="size-3.5" />
      )}
      <span>{tool.label}</span>
    </button>
  );

  return (
    <div className="cw-toolbar">
      <div className="cw-toolbar-row">
        {generateTools.map((t) => renderBtn(t, "primary"))}
      </div>
      <div className="cw-toolbar-row">
        {exportTools.slice(0, 5).map((t) => renderBtn(t, "secondary"))}
        {renderBtn(exportTools[5], "success")}
      </div>
    </div>
  );
}

function IterationsStrip({
  iterations,
  activeId,
  onPreview,
  onRestore,
  onDuplicate,
  onCompare,
  onFavorite,
}: {
  iterations: DesignIteration[];
  activeId: string;
  onPreview: (id: string) => void;
  onRestore: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCompare: (id: string) => void;
  onFavorite: (id: string) => void;
}) {
  return (
    <section className="cw-iterations-strip" aria-label="Design iterations">
      <h3>Versions</h3>
      <div className="cw-iterations-row">
        {iterations.map((it) => (
          <div
            key={it.id}
            className={cn("cw-iter-chip", it.id === activeId && "active")}
          >
            <button
              type="button"
              className="cw-iter-chip-btn"
              onClick={() => onPreview(it.id)}
              title={it.label}
            >
              V{it.version}
              {it.favorite ? <Star className="size-3 fill-current text-[#d4c4b0]" /> : null}
            </button>
            <div className="cw-iter-menu">
              <button type="button" className="cw-iter-menu-trigger" aria-label="Version actions">
                <MoreHorizontal className="size-3.5" />
              </button>
              <div className="cw-iter-menu-popover" role="menu">
                <button type="button" role="menuitem" onClick={() => onPreview(it.id)}>
                  <Eye className="size-3" /> Preview
                </button>
                <button type="button" role="menuitem" onClick={() => onRestore(it.id)}>
                  <RotateCcw className="size-3" /> Restore
                </button>
                <button type="button" role="menuitem" onClick={() => onDuplicate(it.id)}>
                  <Copy className="size-3" /> Duplicate
                </button>
                <button type="button" role="menuitem" onClick={() => onCompare(it.id)}>
                  <GitCompare className="size-3" /> Compare
                </button>
                <button type="button" role="menuitem" onClick={() => onFavorite(it.id)}>
                  <Heart className="size-3" /> Favorite
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="cw-iter-add"
          title="Duplicate current version"
          onClick={() => onDuplicate(activeId)}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </section>
  );
}

function DesignHealthPanel({ health }: { health: PerDesignWorkspace["health"] }) {
  const metrics = Object.entries(health) as Array<[string, number]>;
  return (
    <section className="cw-panel cw-health">
      <h3>Design Health</h3>
      <div className="cw-health-grid">
        {metrics.map(([key, value]) => (
          <RadialScore
            key={key}
            label={formatHealthLabel(key)}
            value={value}
          />
        ))}
      </div>
    </section>
  );
}

function RadialScore({ label, value }: { label: string; value: number }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="cw-radial" title={`${label}: ${value}`}>
      <svg viewBox="0 0 32 32" className="cw-radial-svg cw-radial-animated" aria-hidden>
        <circle cx="16" cy="16" r={r} className="cw-radial-track" />
        <circle
          cx="16"
          cy="16"
          r={r}
          className="cw-radial-fill"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="cw-radial-value">{value}</span>
      <span className="cw-radial-label">{label}</span>
    </div>
  );
}

const PRODUCTION_CHIP_LABELS: Record<string, string> = {
  svg: "SVG",
  mockup: "Mockup",
  aiRender: "AI Render",
  print: "Print",
  embroidery: "Embroidery",
  dtg: "DTG",
  screenPrint: "Screen Print",
  shopify: "Shopify",
  marketing: "Marketing",
  launch: "Launch",
};

function productionStatusIcon(status: string) {
  if (status === "complete") return <Check className="size-3" />;
  if (status === "working") return <Loader2 className="size-3 animate-spin" />;
  return <Circle className="size-2.5" />;
}

function ProductionStatusPanel({ items }: { items: PerDesignWorkspace["production"] }) {
  return (
    <section className="cw-production-strip" aria-label="Production status">
      <h3>Production</h3>
      <div className="cw-prod-chips">
        {items.map((item) => (
          <span
            key={item.id}
            className={cn("cw-prod-chip", `cw-prod-${item.status}`)}
            title={`${item.label}: ${item.status}`}
          >
            <span className="cw-prod-chip-icon" aria-hidden>
              {productionStatusIcon(item.status)}
            </span>
            {PRODUCTION_CHIP_LABELS[item.id] ?? item.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function CollectionTimeline({ current }: { current: CollectionTimelineStage }) {
  const idx = TIMELINE.findIndex((s) => s.id === current);
  return (
    <section className="cw-timeline">
      <ol>
        {TIMELINE.map((stage, i) => (
          <li
            key={stage.id}
            className={cn(
              i < idx && "done",
              i === idx && "current",
            )}
          >
            <span className="cw-timeline-dot" />
            <span>{stage.label}</span>
            {i < TIMELINE.length - 1 ? <span className="cw-timeline-line" /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CreativeDirectorPanel({
  open,
  onToggleOpen,
  messages,
  input,
  loading,
  onInputChange,
  onSend,
  onSuggestion,
}: {
  open: boolean;
  onToggleOpen: () => void;
  messages: PerDesignWorkspace["chat"];
  input: string;
  loading: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onSuggestion: (s: string) => void;
}) {
  return (
    <section className="cw-director-section" aria-label="Creative Director AI">
      <button
        type="button"
        className="cw-director-section-toggle"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-label={open ? "Collapse Creative Director AI" : "Expand Creative Director AI"}
      >
        <div className="cw-director-section-heading">
          <span className="cw-director-section-icon-wrap">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2>Creative Director AI</h2>
            <p className="cw-director-section-subtitle">
              Suggestions, revisions and version ideas
            </p>
          </div>
        </div>
        <ChevronRight
          className={cn("size-4 cw-director-section-chevron", open && "is-open")}
        />
      </button>

      {open ? (
        <div className="cw-director-section-body">
          <div className="cw-director-suggestion-grid">
            {DIRECTOR_SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                className="cw-director-chip"
                onClick={() => onSuggestion(s.prompt)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {messages.length > 0 || loading ? (
            <div className="cw-director-thread">
              {messages.map((m) => (
                <div key={m.id} className={cn("cw-director-msg", m.role)}>
                  {m.content}
                </div>
              ))}
              {loading ? (
                <div className="cw-director-msg assistant">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : null}
            </div>
          ) : null}

          <form
            className="cw-director-input"
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
          >
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Describe the direction you want…"
            />
            <button type="submit" className="cw-btn-primary" disabled={loading || !input.trim()}>
              <MessageSquare className="size-4" />
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function QuickApprovalPanel({
  onApprove,
  onRevision,
  onArchive,
  onBackResearch,
  onImageStudio,
  onCeo,
}: {
  onApprove: () => void;
  onRevision: () => void;
  onArchive: () => void;
  onBackResearch: () => void;
  onImageStudio: () => void;
  onCeo: () => void;
}) {
  return (
    <div className="cw-approval">
      <button type="button" className="cw-approval-btn cw-btn-success" onClick={onApprove}>
        <CheckCircle2 className="size-4" /> Approve
      </button>
      <button type="button" className="cw-approval-btn cw-btn-secondary" onClick={onRevision}>
        Needs Revision
      </button>
      <button type="button" className="cw-approval-btn cw-btn-danger" onClick={onArchive}>
        <Archive className="size-3.5" /> Archive
      </button>
      <button type="button" className="cw-approval-btn cw-btn-secondary" onClick={onBackResearch}>
        Send Back to Research
      </button>
      <button type="button" className="cw-approval-btn cw-btn-secondary" onClick={onImageStudio}>
        Send to Image Studio
      </button>
      <button type="button" className="cw-approval-btn cw-btn-secondary" onClick={onCeo}>
        Send to CEO
      </button>
    </div>
  );
}

function ComparisonModal({
  left,
  right,
  onClose,
  onUseLeft,
  onUseRight,
}: {
  left: DesignIteration;
  right: DesignIteration;
  onClose: () => void;
  onUseLeft: () => void;
  onUseRight: () => void;
}) {
  return (
    <div className="cw-compare-overlay">
      <div className="cw-compare-modal">
        <header>
          <h2>
            <Columns2 className="size-5" /> Compare Versions
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </header>
        <div className="cw-compare-grid">
          <CompareColumn iteration={left} side="A" />
          <CompareColumn iteration={right} side="B" />
        </div>
        <div className="cw-compare-actions">
          <button type="button" onClick={onUseLeft}>Use Left</button>
          <button type="button">Merge</button>
          <button type="button" onClick={onUseRight}>Use Right</button>
        </div>
      </div>
    </div>
  );
}

function CompareColumn({
  iteration,
  side,
}: {
  iteration: DesignIteration;
  side: string;
}) {
  const b = iteration.brief;
  const preview =
    iteration.assets.mockupUrl ?? iteration.assets.svgUrl ?? iteration.assets.renderUrl;
  return (
    <div className="cw-compare-col">
      <h3>
        Version {side} — {iteration.label}
      </h3>
      <div className="cw-compare-preview">
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={preview} alt={iteration.label} />
        ) : (
          <GarmentPlaceholder />
        )}
      </div>
      <dl>
        <div><dt>DNA</dt><dd>{b.dnaScore ?? "—"}%</dd></div>
        <div><dt>Commercial</dt><dd>{b.commercialScore ?? "—"}%</dd></div>
        <div><dt>Campaign</dt><dd>{b.campaignPotential ?? "—"}</dd></div>
        <div><dt>Print</dt><dd>{b.printReadinessScore}%</dd></div>
        <div><dt>Production</dt><dd>{b.productionMethod}</dd></div>
      </dl>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: string }) {
  return (
    <span className="cw-score-pill cw-score-pill-inline">
      <span>{label}</span>
      <strong className="capitalize">{value}</strong>
    </span>
  );
}

function GarmentPlaceholder() {
  return (
    <div className="cw-garment-wrap">
      <svg viewBox="0 0 320 400" className="cw-garment-svg" aria-hidden>
        <defs>
          <linearGradient id="cw-garment-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#63E3E3" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#D9B46B" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#63E3E3" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id="cw-garment-glow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#63E3E3" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#63E3E3" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="160" cy="200" rx="90" ry="120" fill="url(#cw-garment-glow)" />
        <path
          d="M72 95 Q160 48 248 95 L268 128 L248 355 L72 355 L52 128 Z"
          stroke="url(#cw-garment-stroke)"
          strokeWidth="1.4"
          fill="none"
          strokeLinejoin="round"
        />
        <path
          d="M128 95 Q160 72 192 95"
          stroke="url(#cw-garment-stroke)"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
        <rect
          x="128"
          y="168"
          width="64"
          height="78"
          rx="6"
          stroke="url(#cw-garment-stroke)"
          strokeDasharray="5 5"
          strokeWidth="1"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M160 246 L160 310"
          stroke="url(#cw-garment-stroke)"
          strokeWidth="0.8"
          opacity="0.35"
        />
      </svg>
    </div>
  );
}

function formatHealthLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
}
