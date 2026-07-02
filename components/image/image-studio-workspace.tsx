"use client";

import {
  getImageGenerationModeLabel,
  getOpenAiImageModel,
  IMAGE_GENERATION,
} from "@/lib/image/image-generation-config";
import type { ImageStudioAsset, ImageMoodboardSection, ImagePalette } from "@/agents/image/types";
import { ProductionGallery } from "@/components/image/production-gallery";
import {
  AssetPreviewPlaceholder,
  CanvasPlaceholder,
  FashionProductionPipeline,
  ProductionTimeline,
  ProgressRing,
} from "@/components/image/image-studio-primitives";
import {
  applyImageStudioHandoff,
  loadHandoffSendDebug,
  type HandoffLoadDebug,
  type HandoffSaveResult,
  type ImageStudioHandoff,
} from "@/lib/image/image-handoff-store";
import { HandoffDebugOverlay } from "@/components/image/handoff-debug-overlay";
import {
  formatAssetElapsedTime,
  useAssetProgressTimers,
} from "@/components/image/use-asset-progress-timers";
import {
  ASSET_PRIORITY_LABELS,
  assetVersionLabel,
  buildHandoffChecks,
  countCompletedMissionAssets,
  deriveFashionProductionStep,
  deriveMissionStatus,
  FASHION_PRODUCTION_PIPELINE,
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
  type ImportedCreativeBlueprint,
} from "@/lib/image/image-studio-mission";
import {
  executeGeneration,
  runProductionPipeline as runProductionPipelineEngine,
  type ImageProductionProject,
} from "@/lib/image/image-production-pipeline";
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
  useEffect,
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

/** Survives React Strict Mode remounts so handoff apply/bootstrap runs once per navigation. */
let handoffBootstrapLock = false;
let cachedAppliedHandoff: ImageStudioHandoff | null = null;
let cachedProductionProject: ImageRunResult | null = null;
let productionPackagePromise: Promise<ImageRunResult | null> | null = null;

let handoffStagingMissionKey: string | null = null;
let handoffStagingInflight: Promise<ImageRunResult | null> | null = null;

function buildHandoffMissionKey(handoff: ImageStudioHandoff): string {
  return handoff.designId ?? handoff.handoffAt ?? handoff.mission?.title ?? "mission";
}

const HANDOFF_RETRY_DELAYS_MS = [50, 250, 1000] as const;

function resolveGenerationBrief(
  brief: string,
  handoff: ImageStudioHandoff | null,
  blueprint: ImportedCreativeBlueprint | null,
): string {
  const trimmedBrief = brief.trim();
  if (trimmedBrief.length >= 3) return trimmedBrief.slice(0, 4000);

  if (!handoff && !blueprint) return "";

  const candidates = [
    handoff?.brief,
    handoff?.imagePromptPrimary,
    handoff?.mockupPromptPrimary,
    handoff?.concept?.imagePrompt?.primary,
    handoff?.concept?.imagePrompt?.campaign,
    handoff?.concept?.mockupPrompt?.primary,
    handoff?.commercialBlueprint,
    handoff?.concept?.creativeDirection?.summary,
    handoff?.concept?.designStory,
    handoff?.renderPlan?.handoffNotes?.[0],
    blueprint?.imagePrompt,
    blueprint?.mockupPrompt,
    handoff?.mission?.title
      ? `${handoff.mission.title} — ${handoff.mission.collection} — ${handoff.mission.garment} in ${handoff.mission.colorway}`
      : "",
  ];

  for (const candidate of candidates) {
    const text = typeof candidate === "string" ? candidate.trim() : "";
    if (text.length >= 3) return text.slice(0, 4000);
  }

  return "";
}

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
  const [validationDebug, setValidationDebug] = useState<{
    schemaName?: string;
    validationIssues?: Array<{
      field: string;
      path: string;
      expected: string;
      received: unknown;
      receivedLabel?: string;
      message: string;
    }>;
    missingFields?: string[];
    receivedKeys?: string[];
    parsedPreview?: unknown;
    detailedError?: string;
  } | null>(null);
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
  const pipelineLockRef = useRef(false);
  const packageLockRef = useRef(false);
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

  const effectiveBrief = useMemo(
    () => resolveGenerationBrief(brief, handoff, blueprint),
    [brief, handoff, blueprint],
  );

  const canStartGeneration = effectiveBrief.trim().length >= 3;

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

  const assetTimers = useAssetProgressTimers(
    productionAssets,
    preparingAssetId,
    generatingAssetId,
  );

  const handoffChecks = buildHandoffChecks({
    handoff: hasHandoff,
    hasBlueprint,
    imagePrompt: handoff?.imagePromptPrimary ?? brief,
    mockupPrompt: handoff?.mockupPromptPrimary,
    masterArtworkApproved: handoff?.masterArtworkApproved,
  });

  const missionName = blueprint?.designName ?? (hasHandoff ? handoff?.sourceTitle : null) ?? "Waiting for Creative Blueprint";
  const collection = blueprint?.collection ?? "—";
  const garment = blueprint?.garment ?? selectedAsset?.productName ?? "—";
  const colorway = blueprint?.colorway ?? selectedAsset?.color ?? "—";
  const version = blueprint?.version ?? (hasResults ? "V1" : "—");
  const commercialStatus = resolveCommercialStatus(blueprint);
  const generationModeLabel = getImageGenerationModeLabel();
  const isDraftGenerationMode = IMAGE_GENERATION.mode === "draft";
  const generationStatus = resolveGenerationStatus({
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
      return executeGeneration(
        asset,
        {
          reportId: project.reportId,
          reportRecordId: project.reportRecordId,
          projectName: project.projectName,
          productionAssets: project.productionAssets,
        },
        {
          onPreparingAsset: (assetId, slotId) => {
            setPreparingAssetId(assetId);
            setSelectedSlotId(slotId);
            setSelectedAssetId(assetId);
          },
          onGeneratingAsset: (assetId) => {
            setPreparingAssetId(null);
            setGeneratingAssetId(assetId);
          },
          onAssetUpdated: (updated) => {
            setProductionAssets((list) =>
              list.map((item) => (item.id === updated.id ? updated : item)),
            );
          },
          onPipelineActive: () => {},
          onError: (message) => setError(message),
        },
      ).finally(() => {
        setGeneratingAssetId(null);
        setPreparingAssetId(null);
      });
    },
    [],
  );

  const syncCachedProductionAssets = useCallback((nextAssets: ImageStudioAsset[]) => {
    if (!cachedProductionProject) return;
    cachedProductionProject = {
      ...cachedProductionProject,
      productionAssets: nextAssets,
    };
  }, []);

  const runProductionPipeline = useCallback(
    async (project: ImageRunResult, assets: ImageStudioAsset[]): Promise<boolean> => {
      console.info("[Image Studio] runProductionPipeline wrapper invoked", {
        pipelineLockRef: pipelineLockRef.current,
        reportId: project.reportId,
        assetCount: assets.length,
        pendingCount: queuedAssetsForPipeline(assets).length,
      });

      if (pipelineLockRef.current) {
        console.warn("[Image Studio] runProductionPipeline wrapper abort", {
          abortReason: "pipelineLockRef.current is true",
        });
        setError(
          "Production pipeline is already running. Wait for the current run to finish.",
        );
        return false;
      }

      pipelineLockRef.current = true;
      setError(null);

      const productionProject: ImageProductionProject = {
        reportId: project.reportId,
        reportRecordId: project.reportRecordId,
        projectName: project.projectName,
        productionAssets: assets,
      };

      try {
        return await runProductionPipelineEngine(productionProject, assets, {
          onPreparingAsset: (assetId, slotId) => {
            setPreparingAssetId(assetId);
            setSelectedSlotId(slotId);
            setSelectedAssetId(assetId);
          },
          onGeneratingAsset: (assetId) => {
            setPreparingAssetId(null);
            setGeneratingAssetId(assetId);
          },
          onAssetUpdated: (updated) => {
            setProductionAssets((list) => {
              const next = list.map((item) => (item.id === updated.id ? updated : item));
              syncCachedProductionAssets(next);
              return next;
            });
          },
          onPipelineActive: (active) => {
            setPipelineActive(active);
          },
          onError: (message) => setError(message),
        });
      } finally {
        pipelineLockRef.current = false;
        setPreparingAssetId(null);
        setGeneratingAssetId(null);
      }
    },
    [syncCachedProductionAssets],
  );

  const createProductionPackage = useCallback(
    async (briefText: string): Promise<ImageRunResult | null> => {
      const text = briefText.trim();
      if (!text) {
        console.warn("[Image Studio] createProductionPackage skipped — empty brief");
        return null;
      }

      if (cachedProductionProject) {
        console.info("[Image Studio] createProductionPackage using cached project", {
          reportId: cachedProductionProject.reportId,
          assetCount: cachedProductionProject.productionAssets?.length ?? 0,
        });
        setResult(cachedProductionProject);
        setProductionAssets(cachedProductionProject.productionAssets ?? []);
        return cachedProductionProject;
      }

      if (productionPackagePromise) {
        console.info("[Image Studio] createProductionPackage awaiting in-flight request");
        return productionPackagePromise;
      }

      productionPackagePromise = (async () => {
        setIsLoading(true);
        setError(null);
        setValidationDebug(null);

        try {
          console.info("[Image Studio] creating production package", { briefLength: text.length });
          const res = await fetch("/api/image/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brief: text }),
          });
          const data = await res.json();
          if (!res.ok) {
            if (
              data.validationIssues ||
              data.missingFields ||
              data.parsedPreview ||
              data.schemaName
            ) {
              const debug = {
                schemaName: data.schemaName as string | undefined,
                validationIssues: data.validationIssues as
                  | NonNullable<typeof validationDebug>["validationIssues"]
                  | undefined,
                missingFields: data.missingFields as string[] | undefined,
                receivedKeys: data.receivedKeys as string[] | undefined,
                parsedPreview: data.parsedPreview,
                detailedError: data.detailedError as string | undefined,
              };
              setValidationDebug(debug);

              console.error("[Image Studio] schema validation failed", {
                schemaName: debug.schemaName,
                issueCount: debug.validationIssues?.length ?? 0,
              });
              if (debug.parsedPreview) {
                console.error(
                  "[Image Studio] validated payload:",
                  JSON.stringify(debug.parsedPreview, null, 2),
                );
              }
              for (const issue of debug.validationIssues ?? []) {
                console.error(
                  [
                    `❌ ${issue.path}`,
                    `   Field: ${issue.field}`,
                    `   Expected: ${issue.expected}`,
                    `   Received: ${issue.receivedLabel ?? JSON.stringify(issue.received)}`,
                    `   Path: ${issue.path}`,
                    `   Message: ${issue.message}`,
                  ].join("\n"),
                );
              }
              if (debug.detailedError) {
                console.error("[Image Studio] detailed error:\n", debug.detailedError);
              }
            }
            throw new Error(data.error ?? data.detailedError ?? t("image.errors.unexpected"));
          }

          const project = data as ImageRunResult;
          cachedProductionProject = project;
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
          productionPackagePromise = null;
          return null;
        } finally {
          setIsLoading(false);
        }
      })();

      return productionPackagePromise;
    },
    [t],
  );

  const releaseExecutionLocks = useCallback((reason: string) => {
    if (pipelineLockRef.current || packageLockRef.current) {
      console.warn("[Image Studio] releasing stuck execution locks", {
        reason,
        pipelineLockRef: pipelineLockRef.current,
        packageLockRef: packageLockRef.current,
      });
    }
    pipelineLockRef.current = false;
    packageLockRef.current = false;
  }, []);

  const runImage = useCallback(async (): Promise<ImageRunResult | null> => {
    console.info("[Image Studio] runImage entered", {
      briefLength: brief.trim().length,
      effectiveBriefLength: effectiveBrief.trim().length,
      hasHandoff: Boolean(handoff),
      hasBlueprint: Boolean(blueprint),
      pipelineLockRef: pipelineLockRef.current,
      packageLockRef: packageLockRef.current,
      cachedProject: Boolean(cachedProductionProject),
      isLoading,
      pipelineActive,
    });

    const briefForRun = resolveGenerationBrief(brief, handoff, blueprint);
    if (!briefForRun.trim()) {
      console.warn("[Image Studio] runImage early return: missing brief", {
        abortReason: "missing brief",
      });
      setError(
        "Cannot start production: no brief, prompt, or handoff content is available.",
      );
      return null;
    }

    if (!handoff && !blueprint && !brief.trim()) {
      console.warn("[Image Studio] runImage early return: missing handoff", {
        abortReason: "missing handoff",
      });
      setError("Cannot start production: creative handoff was not imported.");
      return null;
    }

    if (briefForRun !== brief.trim()) {
      console.info("[Image Studio] runImage rebuilt brief from handoff sources", {
        briefLength: briefForRun.length,
      });
      setBrief(briefForRun);
    }

    if (packageLockRef.current && !productionPackagePromise) {
      console.warn("[Image Studio] runImage resetting stuck packageLockRef", {
        abortReason: "packageLockRef.current is true",
      });
      packageLockRef.current = false;
    }

    if (pipelineLockRef.current) {
      console.warn("[Image Studio] runImage resetting stuck pipelineLockRef before package", {
        abortReason: "pipelineLockRef.current is true",
      });
      pipelineLockRef.current = false;
    }

    let project: ImageRunResult | null = cachedProductionProject;

    if (!project) {
      console.info("[Image Studio] calling createProductionPackage", {
        briefLength: briefForRun.length,
      });

      packageLockRef.current = true;
      try {
        project = await createProductionPackage(briefForRun);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("image.errors.unexpected");
        console.error("[Image Studio] runImage early return: production package failed", {
          abortReason: "missing production package",
          error: message,
        });
        setError(message);
        releaseExecutionLocks("createProductionPackage-error");
        return null;
      } finally {
        packageLockRef.current = false;
      }
    } else {
      console.info("[Image Studio] runImage using staged production package", {
        reportId: project.reportId,
        assetCount: project.productionAssets?.length ?? 0,
      });
      setResult(project);
      setProductionAssets(project.productionAssets ?? []);
    }

    if (!project) {
      console.warn("[Image Studio] runImage early return: missing production package", {
        abortReason: "missing production package",
      });
      setError((current) =>
        current ??
        "Production package could not be created. Check the error details above.",
      );
      releaseExecutionLocks("missing-production-package");
      return null;
    }

    const assets = project.productionAssets ?? [];
    if (assets.length === 0) {
      console.warn("[Image Studio] runImage early return: empty assets", {
        abortReason: "empty assets",
        reportId: project.reportId,
      });
      setError("Production package has no assets to generate.");
      return project;
    }

    const pendingAssets = queuedAssetsForPipeline(assets);
    if (pendingAssets.length === 0) {
      console.info("[Image Studio] runImage: no pending assets in queue", {
        reportId: project.reportId,
        assetCount: assets.length,
      });
      setError(
        "All mission assets are already generated or completed. Select an asset to regenerate.",
      );
      return project;
    }

    if (pipelineLockRef.current) {
      console.warn("[Image Studio] runImage resetting stuck pipelineLockRef before pipeline", {
        abortReason: "pipelineLockRef.current is true",
      });
      pipelineLockRef.current = false;
    }

    console.info("[Image Studio] calling runProductionPipeline", {
      reportId: project.reportId,
      pendingCount: pendingAssets.length,
    });

    const started = await runProductionPipeline(project, assets);
    if (!started) {
      console.warn("[Image Studio] runImage early return: invalid project pipeline start", {
        abortReason: "invalid project",
        pipelineLockRef: pipelineLockRef.current,
      });
      setError((current) =>
        current ?? "Production pipeline could not start. Try Generate Assets again.",
      );
      releaseExecutionLocks("pipeline-not-started");
    }

    return project;
  }, [
    brief,
    blueprint,
    createProductionPackage,
    effectiveBrief,
    handoff,
    isLoading,
    pipelineActive,
    releaseExecutionLocks,
    runProductionPipeline,
    t,
  ]);

  const generateAssetsButtonLabel = pipelineActive || generatingAssetId
    ? "Generating…"
    : isLoading
      ? "Staging Assets…"
      : "Generate Assets";

  const handleGenerateAssetsClick = useCallback(() => {
    console.info("[Image Studio] Generate Assets clicked", {
      briefLength: brief.trim().length,
      effectiveBriefLength: effectiveBrief.trim().length,
      canStartGeneration,
      isLoading,
      pipelineActive,
      pipelineLockRef: pipelineLockRef.current,
      packageLockRef: packageLockRef.current,
    });
    console.info("[Image Studio] calling runImage");
    void runImage().catch((err) => {
      const message =
        err instanceof Error ? err.message : t("image.errors.unexpected");
      console.error("[Image Studio] runImage unhandled error", { error: message });
      setError(message);
      releaseExecutionLocks("runImage-unhandled-error");
    });
  }, [
    brief,
    canStartGeneration,
    effectiveBrief,
    isLoading,
    pipelineActive,
    releaseExecutionLocks,
    runImage,
    t,
  ]);

  const hydrateCachedProductionPackage = useCallback(() => {
    if (!cachedProductionProject) return false;
    setResult(cachedProductionProject);
    setProductionAssets(cachedProductionProject.productionAssets ?? []);
    return true;
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;
    const retryTimers: ReturnType<typeof setTimeout>[] = [];

    const restoreCachedHandoff = () => {
      if (!cachedAppliedHandoff) return false;
      setHandoff(cachedAppliedHandoff);
      setBrief(cachedAppliedHandoff.brief);
      setHandoffStateApplied(true);
      return true;
    };

    const tryApplyHandoff = (attemptLabel: string) => {
      if (cancelled) return;

      if (handoffBootstrapLock) {
        if (restoreCachedHandoff()) {
          console.info("[Image Studio] handoff restored from cache", { attempt: attemptLabel });
        }
        hydrateCachedProductionPackage();
        return;
      }

      const { handoff: normalized, debug } = applyImageStudioHandoff();
      setHandoffLoadDebug(debug);

      console.info("[Image Studio] handoff raw loaded", {
        attempt: attemptLabel,
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

      handoffBootstrapLock = true;
      cachedAppliedHandoff = normalized;
      setHandoff(normalized);
      setBrief(normalized.brief);
      setHandoffStateApplied(true);

      console.info("[Image Studio] mission state populated", {
        title: normalized.mission?.title,
        collection: normalized.mission?.collection,
        garment: normalized.mission?.garment,
        colorway: normalized.mission?.colorway,
        version: normalized.mission?.version,
      });
    };

    tryApplyHandoff("sync");
    for (const delay of HANDOFF_RETRY_DELAYS_MS) {
      retryTimers.push(setTimeout(() => tryApplyHandoff(`${delay}ms`), delay));
    }

    return () => {
      cancelled = true;
      retryTimers.forEach((timer) => clearTimeout(timer));
    };
  }, [hydrateCachedProductionPackage]);

  useEffect(() => {
    if (!handoffStateApplied || !handoff) return;
    if (cachedProductionProject || productionAssets.length > 0) return;

    const missionBrief = resolveGenerationBrief(brief, handoff, blueprint);
    if (!missionBrief.trim()) {
      console.info("[Image Studio] handoff staging skipped — missing prompt/brief", {
        abortReason: "missing brief",
      });
      return;
    }

    const missionKey = buildHandoffMissionKey(handoff);
    if (handoffStagingMissionKey === missionKey) {
      if (handoffStagingInflight) void handoffStagingInflight;
      return;
    }

    handoffStagingMissionKey = missionKey;
    console.info("[Image Studio] staging production package after handoff", {
      missionKey,
      briefLength: missionBrief.length,
    });
    handoffStagingInflight = createProductionPackage(missionBrief).finally(() => {
      handoffStagingInflight = null;
    });

    void handoffStagingInflight;
  }, [
    handoffStateApplied,
    handoff,
    brief,
    blueprint,
    createProductionPackage,
    productionAssets.length,
  ]);

  const generateSingleAsset = useCallback(
    async (asset: ImageStudioAsset) => {
      if (!result || generatingAssetId || pipelineActive) return;
      await generateAssetInternal(asset, result);
    },
    [generateAssetInternal, generatingAssetId, pipelineActive, result],
  );

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
          <HeroMeta
            label="Generation Mode"
            value={generationModeLabel}
            highlight={isDraftGenerationMode ? "gold" : "emerald"}
          />
          <HeroMeta label="Generation Status" value={generationStatus} highlight={pipelineActive || generatingAssetId ? "emerald" : hasResults ? "gold" : undefined} />
        </div>
      </header>

      <div className="is-toolbar">
        <button
          type="button"
          className="is-toolbar-primary"
          onClick={handleGenerateAssetsClick}
          disabled={isLoading || pipelineActive || !canStartGeneration}
        >
          <Sparkles className="size-4" />
          {generateAssetsButtonLabel}
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

      {error ? (
        <div className="is-error-banner">
          <p className="is-error-banner__summary">{error.split("\n\n")[0]}</p>
          {validationDebug ? (
            <div className="is-error-banner__debug">
              {validationDebug.schemaName ? (
                <p className="is-error-banner__schema">
                  Schema: <code>{validationDebug.schemaName}</code>
                </p>
              ) : null}
              {validationDebug.missingFields?.length ? (
                <p className="is-error-banner__missing">
                  Missing fields: {validationDebug.missingFields.join(", ")}
                </p>
              ) : null}
              {validationDebug.validationIssues?.length ? (
                <ul className="is-error-banner__issues">
                  {validationDebug.validationIssues.map((issue) => (
                    <li key={`${issue.path}-${issue.message}`}>
                      <span className="is-error-banner__issue-path">❌ {issue.path}</span>
                      <dl className="is-error-banner__issue-detail">
                        <div>
                          <dt>Field</dt>
                          <dd>{issue.field}</dd>
                        </div>
                        <div>
                          <dt>Expected</dt>
                          <dd>{issue.expected}</dd>
                        </div>
                        <div>
                          <dt>Received</dt>
                          <dd>
                            {issue.receivedLabel ??
                              (issue.received === undefined
                                ? "undefined"
                                : issue.received === null
                                  ? "null"
                                  : JSON.stringify(issue.received))}
                          </dd>
                        </div>
                        <div>
                          <dt>Path</dt>
                          <dd>{issue.path}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

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
                elapsedMs={asset ? assetTimers[asset.id]?.elapsedMs : undefined}
                elapsedRunning={asset ? assetTimers[asset.id]?.running : false}
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
            {hasResults ? (
              <div className="is-canvas-production">
                {(pipelineActive || generatingAssetId || preparingAssetId) && (
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
                          onClick={handleGenerateAssetsClick}
                          disabled={isLoading || pipelineActive || !canStartGeneration}
                        >
                          <Sparkles className="size-4" />
                          {generateAssetsButtonLabel}
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
                <span className="is-model-badge-model">{getOpenAiImageModel()}</span>
              </div>
              <InspectorField label="Generation Mode" value={generationModeLabel} />
              <InspectorField label="Resolution" value={selectedAsset?.dimensions ?? "1024 × 1024"} />
              <InspectorField label="Seed" value={selectedAsset?.id?.slice(0, 10) ?? "—"} mono />
              <InspectorField
                label="Generation Time"
                value={
                  selectedAsset
                    ? formatAssetElapsedTime(assetTimers[selectedAsset.id]?.elapsedMs)
                    : "—"
                }
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
          { label: "master artwork", value: handoff?.masterArtworkApproved ? "approved" : "—" },
          { label: "master version", value: handoff?.masterArtworkVersion ?? "—" },
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
  elapsedMs,
  elapsedRunning,
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
  elapsedMs?: number;
  elapsedRunning?: boolean;
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
  const timeLabel =
    elapsedRunning || (elapsedMs !== undefined && elapsedMs > 0)
      ? formatAssetElapsedTime(elapsedMs)
      : status === "waiting"
        ? "—"
        : "";
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
        <ProgressRing status={status} progress={progress} size={30} active={active} />
        <span className="is-asset-card-body">
          <span className="is-asset-card-top">
            <span className="is-asset-card-label">{slot.label}</span>
            {slot.commercial ? <span className="is-commercial-badge">COM</span> : null}
          </span>
          <span className="is-asset-card-meta">
            <span className={cn("is-asset-card-status", `is-asset-card-status--${status}`)}>
              <span className={cn("is-production-dot", `is-production-dot--${PRODUCTION_QUEUE_DOT[status]}`)} />
              {MISSION_STATUS_LABELS[status]}
              {status === "ready" ? <span className="is-asset-card-ready-tag">Ready</span> : null}
            </span>
            <span className="is-asset-card-version">{version}</span>
          </span>
          <span className="is-asset-card-footer">
            <span className={cn("is-asset-card-eta", elapsedRunning && "is-asset-card-eta--live")}>
              {timeLabel}
            </span>
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
