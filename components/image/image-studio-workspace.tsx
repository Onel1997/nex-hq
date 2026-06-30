"use client";

import type { ImageStudioAsset } from "@/agents/image/types";
import type { ImageMoodboardSection, ImagePalette } from "@/agents/image/types";
import { ProductionGallery } from "@/components/image/production-gallery";
import {
  AssetPreviewPlaceholder,
  CanvasPlaceholder,
  FashionProductionPipeline,
  ProductionTimeline,
  ProgressRing,
} from "@/components/image/image-studio-primitives";
import {
  acknowledgeImageStudioHandoff,
  loadHandoffSendDebug,
  loadImageStudioHandoffWithDebug,
  type HandoffLoadDebug,
  type HandoffSaveResult,
  type ImageStudioHandoff,
} from "@/lib/image/image-handoff-store";
import { HandoffDebugOverlay } from "@/components/image/handoff-debug-overlay";
import {
  ASSET_ESTIMATED_SECONDS,
  ASSET_PRIORITY_LABELS,
  assetVersionLabel,
  buildHandoffChecks,
  countCompletedMissionAssets,
  deriveFashionProductionStep,
  deriveMissionStatus,
  FASHION_PRODUCTION_PIPELINE,
  formatEstimatedTime,
  HANDOFF_CHECKLIST,
  MISSION_ASSET_SLOTS,
  MISSION_STATUS_LABELS,
  progressForMissionStatus,
  PRODUCTION_QUEUE_DOT,
  queuedAssetsForPipeline,
  resolveMissionSlotAssets,
  type MissionAssetSlot,
} from "@/lib/image/image-studio-assets";
import {
  resolveCommercialStatus,
  resolveGenerationStatus,
  resolveImportedBlueprint,
} from "@/lib/image/image-studio-mission";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  Download,
  Home,
  Palette,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ImageRunResult {
  reportId: string;
  reportRecordId: string;
  projectName: string;
  visualDirection?: string;
  moodboard: ImageMoodboardSection;
  palette: ImagePalette;
  productionAssets: ImageStudioAsset[];
  lookbookShots: unknown[];
  confidence: number;
  sourceReportTitles?: string[];
}

const INSPECTOR_SECTIONS = [
  "queue",
  "model",
  "prompt",
  "progress",
  "review",
  "history",
] as const;

type InspectorSection = (typeof INSPECTOR_SECTIONS)[number];

function InspectorCard({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={cn("is-inspector-card", open && "is-inspector-card--open")}>
      <button type="button" className="is-inspector-card-toggle" onClick={onToggle}>
        <span>{title}</span>
        <ChevronDown className={cn("is-inspector-chevron size-3.5", open && "open")} />
      </button>
      {open ? <div className="is-inspector-card-body">{children}</div> : null}
    </div>
  );
}

export function ImageStudioWorkspace() {
  const t = useT();
  const [handoff, setHandoff] = useState<ImageStudioHandoff | null>(null);
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageRunResult | null>(null);
  const [productionAssets, setProductionAssets] = useState<ImageStudioAsset[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState(MISSION_ASSET_SLOTS[0].id);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<InspectorSection, boolean>>({
    queue: false,
    model: true,
    prompt: true,
    progress: false,
    review: false,
    history: false,
  });
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [revisions, setRevisions] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [generatingAssetId, setGeneratingAssetId] = useState<string | null>(null);
  const [preparingAssetId, setPreparingAssetId] = useState<string | null>(null);
  const [pipelineActive, setPipelineActive] = useState(false);
  const shouldAutoPipelineRef = useRef(false);
  const pipelineLockRef = useRef(false);
  const packageLockRef = useRef(false);
  const bootstrapAttemptRef = useRef(0);
  const [handoffLoadDebug, setHandoffLoadDebug] = useState<HandoffLoadDebug | null>(null);
  const [handoffSendDebug] = useState<HandoffSaveResult | null>(() =>
    typeof window === "undefined" ? null : loadHandoffSendDebug(),
  );
  const [handoffStateApplied, setHandoffStateApplied] = useState(false);

  const selectedSlot = useMemo(
    () => MISSION_ASSET_SLOTS.find((s) => s.id === selectedSlotId) ?? MISSION_ASSET_SLOTS[0],
    [selectedSlotId],
  );

  const missionSlotAssets = useMemo(() => {
    const map = new Map<string, ImageStudioAsset>();
    for (const { slot, asset } of resolveMissionSlotAssets(productionAssets)) {
      map.set(slot.id, asset);
    }
    return map;
  }, [productionAssets]);

  const selectedAsset = useMemo(() => {
    if (selectedAssetId) {
      return productionAssets.find((a) => a.id === selectedAssetId);
    }
    return missionSlotAssets.get(selectedSlotId);
  }, [missionSlotAssets, productionAssets, selectedAssetId, selectedSlotId]);

  const blueprint = useMemo(
    () => resolveImportedBlueprint(handoff, result?.projectName),
    [handoff, result?.projectName],
  );

  const hasBlueprint = Boolean(blueprint?.imported || brief.trim());
  const hasResults = productionAssets.length > 0;
  const hasHandoff = Boolean(handoff);
  const completedAssetCount = useMemo(
    () => countCompletedMissionAssets(productionAssets),
    [productionAssets],
  );
  const allAssetsComplete =
    hasResults && completedAssetCount >= MISSION_ASSET_SLOTS.length;
  const activePipelineSlotId = useMemo(() => {
    if (!generatingAssetId && !preparingAssetId) return null;
    const activeId = generatingAssetId ?? preparingAssetId;
    for (const [slotId, asset] of missionSlotAssets) {
      if (asset.id === activeId) return slotId;
    }
    return null;
  }, [generatingAssetId, missionSlotAssets, preparingAssetId]);

  const handoffChecks = buildHandoffChecks({
    handoff: hasHandoff,
    hasBlueprint,
    imagePrompt: handoff?.imagePromptPrimary ?? brief,
    mockupPrompt: handoff?.mockupPromptPrimary,
  });

  const missionName = blueprint?.designName ?? (hasHandoff ? handoff?.sourceTitle : null) ?? "Waiting for Creative Blueprint";
  const collection = blueprint?.collection ?? "—";
  const garment = blueprint?.garment ?? selectedAsset?.productName ?? "—";
  const colorway = blueprint?.colorway ?? selectedAsset?.color ?? "—";
  const version = blueprint?.version ?? (hasResults ? "V1" : "—");
  const commercialStatus = resolveCommercialStatus(blueprint);
  const generationStatus = resolveGenerationStatus({
    isLoading,
    hasResults,
    hasBlueprint,
    pipelineActive,
    allAssetsComplete,
    preparingAssetId,
    generatingAssetId,
  });

  const productionStep = deriveFashionProductionStep(
    isLoading,
    hasResults,
    hasBlueprint,
    activePipelineSlotId,
  );
  const productionProgressPercent = useMemo(() => {
    if (isLoading) return 12;
    if (!hasResults) return hasBlueprint ? 8 : 0;
    if (allAssetsComplete) return 100;
    const base = 18;
    const span = 82;
    return Math.round(base + (completedAssetCount / MISSION_ASSET_SLOTS.length) * span);
  }, [allAssetsComplete, completedAssetCount, hasBlueprint, hasResults, isLoading]);

  const commercialScore = blueprint?.commercialScore ?? (result ? Math.round((result.confidence ?? 0.82) * 100) : null);

  const getReviewState = useCallback(
    (assetId: string) => {
      if (approved.has(assetId)) return "approved" as const;
      if (revisions.has(assetId)) return "needs_revision" as const;
      return null;
    },
    [approved, revisions],
  );

  const generateAssetInternal = useCallback(
    async (
      asset: ImageStudioAsset,
      project: ImageRunResult,
    ): Promise<ImageStudioAsset | null> => {
      console.info("[Image Studio] startNextAsset → generating", {
        assetId: asset.id,
        assetType: asset.assetType,
        title: asset.title,
      });
      setPreparingAssetId(null);
      setGeneratingAssetId(asset.id);
      setProductionAssets((list) =>
        list.map((item) =>
          item.id === asset.id ? { ...item, status: "generating" } : item,
        ),
      );

      try {
        const res = await fetch("/api/image/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportRecordId: project.reportRecordId,
            reportId: project.reportId,
            assetId: asset.id,
            provider: "openai",
            promptVariant: "openai",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("image.errors.unexpected"));

        const updated: ImageStudioAsset = {
          ...asset,
          status: data.asset.status,
          imageUrl: data.asset.imageUrl,
          createdAt: data.asset.createdAt,
        };
        setProductionAssets((list) =>
          list.map((item) => (item.id === asset.id ? updated : item)),
        );
        console.info("[Image Studio] asset completed", {
          assetId: updated.id,
          status: updated.status,
          hasImage: Boolean(updated.imageUrl),
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : t("image.errors.unexpected");
        console.error("[Image Studio] asset generation failed", {
          assetId: asset.id,
          error: message,
        });
        setError(message);
        setProductionAssets((list) =>
          list.map((item) =>
            item.id === asset.id ? { ...item, status: "failed", message } : item,
          ),
        );
        return null;
      } finally {
        setGeneratingAssetId(null);
      }
    },
    [t],
  );

  const runProductionPipeline = useCallback(
    async (project: ImageRunResult, assets: ImageStudioAsset[]) => {
      if (pipelineLockRef.current) {
        console.warn("[Image Studio] queue runner skipped — pipeline already active");
        return;
      }

      const queue = resolveMissionSlotAssets(assets).filter(
        ({ asset }) => !asset.imageUrl && asset.status !== "completed",
      );

      console.info("[Image Studio] queue runner starting", {
        queuedCount: queue.length,
        slots: queue.map(({ slot, asset }) => ({
          slot: slot.id,
          assetId: asset.id,
          assetType: asset.assetType,
        })),
      });

      if (queue.length === 0) {
        console.warn("[Image Studio] queue runner aborted — no queued assets");
        return;
      }

      pipelineLockRef.current = true;
      setPipelineActive(true);
      setError(null);

      let currentAssets = assets;
      try {
        for (const { slot, asset } of queue) {
          setPreparingAssetId(asset.id);
          setSelectedSlotId(slot.id);
          setSelectedAssetId(asset.id);
          if (queue[0]?.asset.id === asset.id) {
            console.info("[Image Studio] first asset preparing", {
              slot: slot.id,
              assetId: asset.id,
            });
          } else {
            console.info("[Image Studio] startNextAsset → preparing", {
              slot: slot.id,
              assetId: asset.id,
            });
          }

          if (queue[0]?.asset.id === asset.id) {
            console.info("[Image Studio] first asset generating", {
              slot: slot.id,
              assetId: asset.id,
            });
          }

          const updated = await generateAssetInternal(asset, project);
          if (!updated) continue;

          currentAssets = currentAssets.map((item) =>
            item.id === updated.id ? updated : item,
          );
        }
      } finally {
        setPreparingAssetId(null);
        pipelineLockRef.current = false;
        setPipelineActive(false);
        console.info("[Image Studio] queue runner finished");
      }
    },
    [generateAssetInternal],
  );

  const createProductionPackage = useCallback(
    async (briefText: string): Promise<ImageRunResult | null> => {
      const text = briefText.trim();
      if (!text) {
        console.warn("[Image Studio] createProductionPackage skipped — empty brief");
        return null;
      }
      if (packageLockRef.current) {
        console.warn("[Image Studio] createProductionPackage skipped — package request in flight");
        return null;
      }

      packageLockRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        console.info("[Image Studio] creating production package", { briefLength: text.length });
        const res = await fetch("/api/image/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: text }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? t("image.errors.unexpected"));
        }

        const project = data as ImageRunResult;
        setResult(project);
        setProductionAssets(project.productionAssets ?? []);
        console.info("[Image Studio] queue created", {
          reportId: project.reportId,
          assetCount: project.productionAssets?.length ?? 0,
          queuedCount: queuedAssetsForPipeline(project.productionAssets ?? []).length,
        });
        return project;
      } catch (err) {
        const message = err instanceof Error ? err.message : t("image.errors.unexpected");
        console.error("[Image Studio] production package failed", { error: message });
        setError(message);
        return null;
      } finally {
        packageLockRef.current = false;
        setIsLoading(false);
      }
    },
    [t],
  );

  const bootstrapFromHandoff = useCallback(
    async (handoffData: ImageStudioHandoff) => {
      const attempt = ++bootstrapAttemptRef.current;
      console.info("[Image Studio] mission state populated", {
        attempt,
        title: handoffData.mission?.title ?? handoffData.sourceTitle,
        collection: handoffData.mission?.collection,
        garment: handoffData.mission?.garment,
        colorway: handoffData.mission?.colorway,
        version: handoffData.mission?.version,
      });

      const project = await createProductionPackage(handoffData.brief);
      if (!project) {
        console.warn("[Image Studio] auto pipeline aborted — queue not created", { attempt });
        return;
      }

      if (!shouldAutoPipelineRef.current) {
        console.info("[Image Studio] auto pipeline disabled after package creation", { attempt });
        return;
      }

      console.info("[Image Studio] auto pipeline starting", {
        attempt,
        queuedCount: queuedAssetsForPipeline(project.productionAssets ?? []).length,
      });
      await runProductionPipeline(project, project.productionAssets ?? []);
    },
    [createProductionPackage, runProductionPipeline],
  );

  const bootstrapFromHandoffRef = useRef(bootstrapFromHandoff);
  bootstrapFromHandoffRef.current = bootstrapFromHandoff;

  useLayoutEffect(() => {
    const { handoff: normalized, debug } = loadImageStudioHandoffWithDebug();
    setHandoffLoadDebug(debug);

    console.info("[Image Studio] handoff raw loaded", {
      rawFound: debug.rawFound,
      source: debug.source,
      parsed: debug.parsed,
      rejectReason: debug.rejectReason,
    });

    if (!normalized) {
      console.info("[Image Studio] handoff not present or invalid", debug.rejectReason);
      return;
    }

    console.info("[Image Studio] handoff brief validated", {
      briefLength: normalized.brief.length,
      title: normalized.mission?.title ?? normalized.sourceTitle,
      hasConcept: Boolean(normalized.concept),
      imagePrompt: Boolean(normalized.imagePromptPrimary),
      mockupPrompt: Boolean(normalized.mockupPromptPrimary),
    });

    shouldAutoPipelineRef.current = true;
    setHandoff(normalized);
    setBrief(normalized.brief);
    setHandoffStateApplied(true);
    acknowledgeImageStudioHandoff();

    console.info("[Image Studio] mission state populated", {
      title: normalized.mission?.title,
      collection: normalized.mission?.collection,
      garment: normalized.mission?.garment,
      colorway: normalized.mission?.colorway,
      version: normalized.mission?.version,
    });

    void bootstrapFromHandoffRef.current(normalized);
  }, []);

  const generateSingleAsset = useCallback(
    async (asset: ImageStudioAsset) => {
      if (!result || generatingAssetId || pipelineActive) return;
      await generateAssetInternal(asset, result);
    },
    [generateAssetInternal, generatingAssetId, pipelineActive, result],
  );

  const runImage = useCallback(async () => {
    const project = await createProductionPackage(brief);
    if (project && shouldAutoPipelineRef.current && !pipelineLockRef.current) {
      await runProductionPipeline(project, project.productionAssets ?? []);
    }
    return project;
  }, [brief, createProductionPackage, runProductionPipeline]);

  const updateAsset = useCallback((updated: ImageStudioAsset) => {
    setProductionAssets((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)),
    );
  }, []);

  const toggleSection = (id: InspectorSection) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activePrompt =
    selectedAsset?.prompt.openai ?? blueprint?.imagePrompt ?? handoff?.imagePromptPrimary ?? brief;

  const printReadiness = handoff?.concept?.productionNotes?.printReadiness?.join(", ") ?? "Awaiting asset generation";

  const versionTimeline = [
    { version: blueprint?.version ?? "V1", label: "Blueprint imported", time: handoff?.handoffAt ? new Date(handoff.handoffAt).toLocaleString() : "—" },
    ...(hasResults ? [{ version: "V1.0", label: "Production package created", time: "Mission staged" }] : []),
    ...(selectedAsset?.createdAt
      ? [{ version: assetVersionLabel(selectedAsset), label: selectedAsset.title ?? "Asset render", time: new Date(selectedAsset.createdAt).toLocaleString() }]
      : []),
  ];

  return (
    <div className="is-root">
      <header className="is-topbar">
        <nav className="is-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/" className="is-crumb">
            <Home className="size-3.5" />
            Facility
          </Link>
          <span className="is-crumb-sep" aria-hidden>›</span>
          <span className="is-crumb is-crumb-current">
            <Palette className="size-3.5" />
            Image Studio
          </span>
        </nav>
      </header>

      {/* Mission header */}
      <header className="is-hero-mission">
        <div className="is-hero-mission-primary">
          <h1 className="is-hero-title">{missionName}</h1>
          <p className="is-hero-subtitle">Ready for Premium Asset Production</p>
        </div>
        <div className="is-hero-meta-row">
          <HeroMeta label="Collection" value={collection} />
          <HeroMeta label="Garment" value={garment} />
          <HeroMeta label="Colorway" value={colorway} />
          <HeroMeta label="Version" value={version} />
          <HeroMeta label="Commercial Status" value={commercialStatus} highlight="gold" />
          <HeroMeta label="Generation Status" value={generationStatus} highlight={pipelineActive || hasResults || isLoading ? "emerald" : undefined} />
        </div>
      </header>

      <div className="is-toolbar">
        <button
          type="button"
          className="is-toolbar-primary"
          onClick={() => void runImage()}
          disabled={isLoading || pipelineActive || !brief.trim()}
        >
          <Sparkles className="size-4" />
          {isLoading || pipelineActive ? "Generating…" : "Generate Assets"}
        </button>
        <div className="is-toolbar-divider" aria-hidden />
        <div className="is-toolbar-secondary">
          <ToolbarGhost disabled={!hasResults}>Variations</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Hero</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Campaign</ToolbarGhost>
          <ToolbarGhost disabled={!selectedAsset?.imageUrl}>Upscale</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Export</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>
            <Download className="size-3.5" />
            ZIP
          </ToolbarGhost>
        </div>
        <div className="is-toolbar-divider" aria-hidden />
        <div className="is-toolbar-secondary is-toolbar-secondary--muted">
          <ToolbarGhost disabled={!hasResults}>Commercial</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Marketing</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Shopify</ToolbarGhost>
        </div>
      </div>

      {error ? <div className="is-error-banner">{error}</div> : null}

      <div className="is-body">
        <aside className="is-sidebar">
          <div className="is-sidebar-header">
            <h2 className="is-sidebar-title">Production Queue</h2>
            <p className="is-sidebar-sub">{MISSION_ASSET_SLOTS.length} assets · individual or batch</p>
          </div>
          <ul className="is-asset-list">
            {MISSION_ASSET_SLOTS.map((slot) => {
              const asset = missionSlotAssets.get(slot.id);
              return (
              <MissionAssetCard
                key={slot.id}
                slot={slot}
                asset={asset}
                assets={productionAssets}
                active={selectedSlotId === slot.id}
                hasBlueprint={hasBlueprint}
                generatingAssetId={generatingAssetId}
                preparingAssetId={preparingAssetId}
                reviewState={asset ? getReviewState(asset.id) : null}
                onSelect={() => {
                  setSelectedSlotId(slot.id);
                  setSelectedAssetId(asset?.id ?? null);
                }}
                onGenerate={() => {
                  if (asset) void generateSingleAsset(asset);
                }}
              />
            );
            })}
          </ul>
        </aside>

        <main className="is-canvas-column">
          <div className={cn("is-canvas", hasBlueprint && !hasResults && "is-canvas--staged")}>
            {isLoading ? (
              <div className="is-production-overlay">
                <CanvasPlaceholder hasBlueprint garmentLabel={garment} />
                <div className="is-production-overlay-content">
                  <p className="is-production-phase">
                    {FASHION_PRODUCTION_PIPELINE.find((s) => s.id === productionStep)?.label}
                  </p>
                  <FashionProductionPipeline activeStep={productionStep} />
                </div>
              </div>
            ) : hasResults ? (
              <div className="is-canvas-production">
                {(pipelineActive || generatingAssetId) && (
                  <div className="is-production-overlay is-production-overlay--inline">
                    <div className="is-production-overlay-content">
                      <p className="is-production-phase">
                        {FASHION_PRODUCTION_PIPELINE.find((s) => s.id === productionStep)?.label}
                      </p>
                      <FashionProductionPipeline activeStep={productionStep} />
                    </div>
                  </div>
                )}
                <ProductionGallery
                assets={productionAssets}
                reportId={result!.reportId}
                reportRecordId={result!.reportRecordId}
                selectedAssetId={selectedAssetId}
                confidence={result?.confidence}
                favorites={favorites}
                approved={approved}
                revisions={revisions}
                compareMode={compareMode}
                onSelectAsset={(asset) => {
                  setSelectedAssetId(asset.id);
                  const slot = MISSION_ASSET_SLOTS.find((s) =>
                    s.assetTypes.includes(asset.assetType),
                  );
                  if (slot) setSelectedSlotId(slot.id);
                }}
                onUpdated={updateAsset}
                onToggleFavorite={(id) =>
                  setFavorites((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onApprove={(id) => {
                  setApproved((prev) => new Set(prev).add(id));
                  setRevisions((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                }}
                onNeedsRevision={(id) => {
                  setRevisions((prev) => new Set(prev).add(id));
                  setApproved((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                }}
                onToggleCompare={() => setCompareMode((v) => !v)}
              />
              </div>
            ) : (
              <div className="is-staging-dashboard">
                <CanvasPlaceholder
                  hasBlueprint={hasBlueprint}
                  garmentLabel={garment !== "—" ? garment : "Garment"}
                />

                <div className="is-staging-panel">
                  {hasHandoff && blueprint ? (
                    <>
                      <div className="is-handoff-checklist">
                        <h3 className="is-panel-heading">Creative Blueprint</h3>
                        <ul className="is-checklist">
                          {HANDOFF_CHECKLIST.map((item) => {
                            const done = item.check(handoffChecks);
                            return (
                              <li key={item.id} className={cn("is-checklist-item", done && "done")}>
                                <Check className="size-3.5" />
                                {item.label}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <BlueprintSummary blueprint={blueprint} />
                      <div className="is-staging-actions">
                        <button
                          type="button"
                          className="is-btn is-btn--primary"
                          onClick={() => void runImage()}
                          disabled={isLoading || pipelineActive || !brief.trim()}
                        >
                          <Sparkles className="size-4" />
                          {isLoading || pipelineActive ? "Starting Production…" : "Generate Assets"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="is-empty-state">
                      <div className="is-empty-state-glass">
                        <div className="is-empty-illustration-mark" aria-hidden>
                          <Palette className="size-14" />
                        </div>
                        <h2 className="is-empty-headline">Waiting for Creative Blueprint</h2>
                        <p className="is-handoff-empty-text">
                          Import a finished design from Design Studio to begin premium asset production.
                        </p>
                        <Link href="/agents/design" className="is-btn is-btn--primary is-btn--cta">
                          Import from Design Studio
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <ProductionTimeline currentStep="image-studio" hasResults={hasResults} />
        </main>

        <aside className="is-inspector">
          <div className="is-inspector-header">
            <h2 className="is-inspector-title">Production Inspector</h2>
            <p className="is-inspector-asset">{selectedAsset?.title ?? selectedSlot.label}</p>
          </div>

          <div className="is-inspector-actions">
            <button type="button" className="is-inspector-action is-inspector-action--primary" disabled={!selectedAsset?.imageUrl} onClick={() => selectedAsset && setApproved((p) => new Set(p).add(selectedAsset.id))}>
              Approve
            </button>
            <button type="button" className="is-inspector-action" disabled={!selectedAsset} onClick={() => selectedAsset && void generateSingleAsset(selectedAsset)}>
              Regenerate
            </button>
            <button type="button" className="is-inspector-action" disabled={!selectedAsset?.imageUrl}>Upscale</button>
            <button type="button" className="is-inspector-action" disabled={!selectedAsset?.imageUrl}>Remove BG</button>
            <button type="button" className="is-inspector-action" disabled={!selectedAsset}>Variations</button>
          </div>

          <div className="is-inspector-cards">
            <InspectorCard
              title="Live Queue"
              open={openSections.queue}
              onToggle={() => toggleSection("queue")}
            >
              {MISSION_ASSET_SLOTS.map((slot) => {
                const asset = missionSlotAssets.get(slot.id);
                const status = deriveMissionStatus(slot, productionAssets, {
                  hasBlueprint,
                  generatingAssetId,
                  preparingAssetId,
                  reviewState: asset ? getReviewState(asset.id) : null,
                });
                return (
                  <div
                    key={slot.id}
                    className={cn("is-queue-row", selectedSlotId === slot.id && "active")}
                  >
                    <span className={cn("is-queue-status-dot", `is-queue-status-dot--${PRODUCTION_QUEUE_DOT[status]}`)} />
                    <span className="is-queue-name">{slot.label}</span>
                    <span className="is-queue-status">{MISSION_STATUS_LABELS[status]}</span>
                  </div>
                );
              })}
            </InspectorCard>

            <InspectorCard
              title="Current Model"
              open={openSections.model}
              onToggle={() => toggleSection("model")}
            >
              <div className="is-model-badge">
                <span className="is-model-badge-provider">OpenAI Images</span>
                <span className="is-model-badge-model">gpt-image-1</span>
              </div>
              <InspectorField label="Resolution" value={selectedAsset?.dimensions ?? "1024 × 1024"} />
              <InspectorField label="Seed" value={selectedAsset?.id?.slice(0, 10) ?? "—"} mono />
              <InspectorField
                label="Generation Time"
                value={selectedAsset?.createdAt ? new Date(selectedAsset.createdAt).toLocaleTimeString() : formatEstimatedTime(ASSET_ESTIMATED_SECONDS[selectedSlot.id] ?? 35)}
              />
            </InspectorCard>

            <InspectorCard
              title="Prompt"
              open={openSections.prompt}
              onToggle={() => toggleSection("prompt")}
            >
              <div className="is-code-block">
                <span className="is-code-label">prompt</span>
                <pre className="is-code-pre">{activePrompt || "—"}</pre>
              </div>
              <div className="is-code-block">
                <span className="is-code-label">negative</span>
                <pre className="is-code-pre">low quality, blurry, watermark, distorted anatomy</pre>
              </div>
            </InspectorCard>

            <InspectorCard
              title="Production Progress"
              open={openSections.progress}
              onToggle={() => toggleSection("progress")}
            >
              <FashionProductionPipeline activeStep={productionStep} />
              <div className="is-progress-bar">
                <div
                  className="is-progress-fill"
                  style={{ width: `${productionProgressPercent}%` }}
                />
              </div>
            </InspectorCard>

            <InspectorCard
              title="Commercial Review"
              open={openSections.review}
              onToggle={() => toggleSection("review")}
            >
              <div className="is-score-cards">
                <ScoreCard label="Commercial" value={commercialScore ?? "—"} unit={commercialScore != null ? "%" : ""} accent="emerald" />
                <ScoreCard label="Luxury" value={commercialScore != null ? Math.min(99, commercialScore + 2) : "—"} unit={commercialScore != null ? "%" : ""} accent="gold" />
                <ScoreCard label="Print Ready" value={hasResults ? "Staged" : "Pending"} accent="muted" />
              </div>
              <InspectorField label="Print Readiness" value={printReadiness} />
              <InspectorField label="Blueprint Review" value={blueprint?.blueprintReview ?? "—"} />
            </InspectorCard>

            <InspectorCard
              title="Version Timeline"
              open={openSections.history}
              onToggle={() => toggleSection("history")}
            >
              <div className="is-version-timeline">
                {versionTimeline.map((entry, i) => (
                  <div key={`${entry.version}-${i}`} className="is-version-entry">
                    <span className="is-version-marker" data-first={i === 0} />
                    <div className="is-version-content">
                      <span className="is-version-id">{entry.version}</span>
                      <span className="is-version-label">{entry.label}</span>
                      <span className="is-version-time">{entry.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </InspectorCard>
          </div>
        </aside>
      </div>

      <HandoffDebugOverlay
        title="Image Studio — Handoff Receive"
        rows={[
          { label: "raw handoff found", value: handoffLoadDebug?.rawFound ? "yes" : "no" },
          { label: "storage key", value: handoffLoadDebug?.storageKey ?? "nexhq-image-studio-handoff" },
          { label: "source", value: handoffLoadDebug?.source ?? "pending" },
          { label: "parsed", value: handoffLoadDebug?.parsed ? "yes" : "no" },
          { label: "state applied", value: handoffStateApplied ? "yes" : "no" },
          { label: "title", value: handoffLoadDebug?.title ?? handoff?.mission?.title ?? "—" },
          { label: "collection", value: handoffLoadDebug?.collection ?? blueprint?.collection ?? "—" },
          { label: "garment", value: handoffLoadDebug?.garment ?? blueprint?.garment ?? "—" },
          { label: "colorway", value: handoffLoadDebug?.colorway ?? blueprint?.colorway ?? "—" },
          { label: "brief length", value: String(handoffLoadDebug?.briefLength ?? brief.length) },
          ...(handoffLoadDebug?.rejectReason
            ? [{ label: "reason if rejected", value: handoffLoadDebug.rejectReason }]
            : []),
          ...(handoffSendDebug
            ? [
                { label: "— send debug —", value: "" },
                { label: "design saved", value: handoffSendDebug.saved ? "yes" : "no" },
                { label: "design localStorage", value: handoffSendDebug.localStorage ? "yes" : "no" },
                { label: "design sessionStorage", value: handoffSendDebug.sessionStorage ? "yes" : "no" },
              ]
            : []),
        ]}
      />
    </div>
  );
}

function HeroMeta({
  label,
  value,
  highlight,
  wide,
}: {
  label: string;
  value: string;
  highlight?: "emerald" | "gold";
  wide?: boolean;
}) {
  return (
    <div className={cn("is-hero-meta", wide && "is-hero-meta--wide")}>
      <span className="is-hero-meta-label">{label}</span>
      <span
        className={cn(
          "is-hero-meta-value",
          highlight === "emerald" && "is-hero-meta-value--emerald",
          highlight === "gold" && "is-hero-meta-value--gold",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ToolbarGhost({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="is-toolbar-ghost" disabled={disabled}>
      {children}
    </button>
  );
}

function InspectorField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="is-field">
      <span className="is-field-label">{label}</span>
      <span className={cn("is-field-value", mono && "is-field-value--mono")}>{value}</span>
    </div>
  );
}

function BlueprintSummary({ blueprint }: { blueprint: import("@/lib/image/image-studio-mission").ImportedCreativeBlueprint }) {
  return (
    <div className="is-blueprint-summary">
      <div className="is-blueprint-summary-row">
        <span className="is-blueprint-summary-label">Creative Direction</span>
        <p className="is-blueprint-summary-text">{blueprint.creativeDirection}</p>
      </div>
      <div className="is-blueprint-summary-grid">
        <div>
          <span className="is-blueprint-summary-label">Design Story</span>
          <p>{blueprint.designStory}</p>
        </div>
        <div>
          <span className="is-blueprint-summary-label">Fashion Language</span>
          <p>{blueprint.fashionLanguage}</p>
        </div>
        <div>
          <span className="is-blueprint-summary-label">Commercial Intent</span>
          <p>{blueprint.commercialIntent}</p>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent: "emerald" | "gold" | "muted";
}) {
  return (
    <div className={cn("is-score-card", `is-score-card--${accent}`)}>
      <span className="is-score-card-label">{label}</span>
      <span className="is-score-card-value">
        {value}
        {unit}
      </span>
    </div>
  );
}

function MissionAssetCard({
  slot,
  asset,
  assets,
  active,
  hasBlueprint,
  generatingAssetId,
  preparingAssetId,
  reviewState,
  onSelect,
  onGenerate,
}: {
  slot: MissionAssetSlot;
  asset?: ImageStudioAsset;
  assets: ImageStudioAsset[];
  active: boolean;
  hasBlueprint: boolean;
  generatingAssetId?: string | null;
  preparingAssetId?: string | null;
  reviewState?: "approved" | "needs_revision" | null;
  onSelect: () => void;
  onGenerate?: () => void;
}) {
  const status = deriveMissionStatus(slot, assets, {
    hasBlueprint,
    generatingAssetId,
    preparingAssetId,
    reviewState,
  });
  const progress = progressForMissionStatus(status);
  const version = asset ? assetVersionLabel(asset) : hasBlueprint ? "v1" : "—";
  const estimate = formatEstimatedTime(ASSET_ESTIMATED_SECONDS[slot.id] ?? 35);
  const canGenerate =
    Boolean(asset && !asset.imageUrl && !generatingAssetId && !preparingAssetId && asset.status !== "completed");

  return (
    <li>
      <button
        type="button"
        className={cn("is-asset-card", active && "is-asset-card--active")}
        onClick={onSelect}
      >
        <AssetPreviewPlaceholder
          slotId={slot.id}
          imageUrl={asset?.imageUrl}
          active={active}
        />
        <ProgressRing progress={progress} size={30} active={active} />
        <span className="is-asset-card-body">
          <span className="is-asset-card-top">
            <span className="is-asset-card-label">{slot.label}</span>
            {slot.commercial ? <span className="is-commercial-badge">COM</span> : null}
          </span>
          <span className="is-asset-card-meta">
            <span className={cn("is-asset-card-status", `is-asset-card-status--${status}`)}>
              <span className={cn("is-production-dot", `is-production-dot--${PRODUCTION_QUEUE_DOT[status]}`)} />
              {MISSION_STATUS_LABELS[status]}
            </span>
            <span className="is-asset-card-version">{version}</span>
          </span>
          <span className="is-asset-card-footer">
            <span className="is-asset-card-eta">{estimate}</span>
            <span className={cn("is-priority-badge", `is-priority-badge--${slot.priority}`)}>
              {ASSET_PRIORITY_LABELS[slot.priority]}
            </span>
          </span>
        </span>
      </button>
      {canGenerate ? (
        <button type="button" className="is-asset-generate" onClick={onGenerate}>
          Generate
        </button>
      ) : null}
    </li>
  );
}
