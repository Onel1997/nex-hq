"use client";

import { IMAGE_GENERATION } from "@/lib/image/image-generation-config";
import type { ImageStudioAsset, ImageMoodboardSection, ImagePalette } from "@/agents/image/types";
import { ProductionGallery } from "@/components/image/production-gallery";
import { BrandModelSelector } from "@/components/image/brand-model-selector";
import { ProductProductionSelector } from "@/components/image/product-production-selector";
import { DeterministicV2Panel } from "@/components/image/deterministic-v2-panel";
import {
  AssetPreviewPlaceholder,
  CanvasPlaceholder,
  FashionProductionPipeline,
  ProductionTimeline,
  ProgressRing,
} from "@/components/image/image-studio-primitives";
import {
  applyImageStudioHandoff,
  acknowledgeImageStudioHandoff,
  loadHandoffSendDebug,
  type HandoffLoadDebug,
  type HandoffSaveResult,
  type ImageStudioHandoff,
} from "@/lib/image/image-handoff-store";
import { bootstrapImageStudioHandoff } from "@/lib/image/image-studio-handoff-bootstrap";
import {
  applyMasterArtworkToBrief,
  enrichProductionAssetsWithMasterArtwork,
} from "@/lib/image/master-artwork-production";
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
import type {
  ImageBrandModelProductionContext,
  ImageBrandModelSelection,
} from "@/lib/image/brand-model-production-context";
import type { ImageGenerationJobView } from "@/lib/image/paid-generation/types";
import type { ImageProductionAssetView } from "@/lib/image/production-project/types";
import type {
  ProductProductionContext,
  ProductProductionSelection,
} from "@/lib/image/product-production-context";
import type { ImageProductSelection } from "@/lib/image/product-production-client";
import {
  formatPaidPrepareError,
  logPaidPrepareValidationError,
} from "@/lib/image/prepare-estimate-error";
import {
  productionProjectMatchesBrandModel,
  resolveBrandModelTraceForPrepare,
  resolveDurableMasterArtworkReference,
  resolvePaidPrepareIdentityBlocker,
  resolvePaidJobStaleReason,
} from "@/lib/image/image-studio-prepare-identity";
import {
  canPreparePaidImageEstimate,
  isImageStudioHandoffDebugEnabled,
  resolveDesignMissionHints,
  resolveImageStudioProductHeader,
  resolvePrepareEstimateBlocker,
} from "@/lib/image/image-studio-product-display";
import {
  isResearchReportTitle,
  RESEARCH_ARTWORK_PROVENANCE,
  formatArtworkSecondaryLine,
  resolveArtworkDisplayName,
} from "@/lib/design/artwork-display-name";
import { useT } from "@/lib/i18n";
import {
  ownerAuthorityLabel,
  ownerShotLabel,
  ownerStatusLabel,
} from "@/lib/ux/owner-terminology";
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
  brandModelContext?: ImageBrandModelProductionContext;
}

type InspectorSection =
  | "queue"
  | "model"
  | "product"
  | "prompt"
  | "progress"
  | "review"
  | "history";

/** Survives React Strict Mode remounts so handoff apply/bootstrap runs once per navigation. */
let handoffBootstrapLock = false;
let cachedAppliedArtworkHandoff: ImageStudioHandoff | null = null;
let cachedProjectContextHandoff: ImageStudioHandoff | null = null;
let cachedProductionProject: ImageRunResult | null = null;
let productionPackagePromise: Promise<ImageRunResult | null> | null = null;

let handoffStagingMissionKey: string | null = null;
let handoffStagingInflight: Promise<ImageRunResult | null> | null = null;

function clearCachedProductionProject() {
  cachedProductionProject = null;
  productionPackagePromise = null;
  handoffStagingMissionKey = null;
  handoffStagingInflight = null;
}

function buildHandoffMissionKey(handoff: ImageStudioHandoff): string {
  return handoff.designId ?? handoff.handoffAt ?? handoff.mission?.title ?? "mission";
}

const HANDOFF_RETRY_DELAYS_MS = [50, 250, 1000] as const;

function resolveGenerationBrief(
  brief: string,
  artworkHandoff: ImageStudioHandoff | null,
  projectContextHandoff: ImageStudioHandoff | null,
  blueprint: ImportedCreativeBlueprint | null,
): string {
  const contextHandoff = projectContextHandoff ?? artworkHandoff;
  const trimmedBrief = brief.trim();
  if (trimmedBrief.length >= 3) {
    return applyMasterArtworkToBrief(trimmedBrief.slice(0, 4000), artworkHandoff);
  }

  if (!contextHandoff && !blueprint) return "";

  const candidates = [
    contextHandoff?.brief,
    contextHandoff?.imagePromptPrimary,
    contextHandoff?.mockupPromptPrimary,
    contextHandoff?.concept?.imagePrompt?.primary,
    contextHandoff?.concept?.imagePrompt?.campaign,
    contextHandoff?.concept?.mockupPrompt?.primary,
    contextHandoff?.commercialBlueprint,
    contextHandoff?.concept?.creativeDirection?.summary,
    contextHandoff?.concept?.designStory,
    contextHandoff?.renderPlan?.handoffNotes?.[0],
    blueprint?.imagePrompt,
    blueprint?.mockupPrompt,
    contextHandoff?.mission?.title
      ? `${contextHandoff.mission.title} — ${contextHandoff.mission.collection} — ${contextHandoff.mission.garment} in ${contextHandoff.mission.colorway}`
      : "",
  ];

  for (const candidate of candidates) {
    const text = typeof candidate === "string" ? candidate.trim() : "";
    if (text.length >= 3) {
      return applyMasterArtworkToBrief(text.slice(0, 4000), artworkHandoff);
    }
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
  const [projectContextHandoff, setProjectContextHandoff] =
    useState<ImageStudioHandoff | null>(null);
  const [brandModelSelection, setBrandModelSelection] =
    useState<ImageBrandModelSelection | null>(null);
  const [productSelection, setProductSelection] =
    useState<ProductProductionSelection | null>(null);
  const [imageProductSelection, setImageProductSelection] =
    useState<ImageProductSelection | null>(null);
  const [productProductionContext, setProductProductionContext] =
    useState<ProductProductionContext | null>(null);
  const [selectedProductLabel, setSelectedProductLabel] = useState<string | null>(null);
  const [showHandoffDebug, setShowHandoffDebug] = useState(false);
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
    product: true,
    prompt: true,
    progress: false,
    review: false,
    history: false,
  });
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [revisions, setRevisions] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [generatingAssetId] = useState<string | null>(null);
  const [preparingAssetId] = useState<string | null>(null);
  const [pipelineActive] = useState(false);
  const [paidJob, setPaidJob] = useState<ImageGenerationJobView | null>(null);
  const [paidJobBusy, setPaidJobBusy] = useState(false);
  const [durableAssets, setDurableAssets] = useState<ImageProductionAssetView[]>([]);
  const pipelineLockRef = useRef(false);
  const packageLockRef = useRef(false);
  const [handoffLoadDebug, setHandoffLoadDebug] = useState<HandoffLoadDebug | null>(null);
  const [handoffSendDebug] = useState<HandoffSaveResult | null>(() =>
    typeof window === "undefined" ? null : loadHandoffSendDebug(),
  );
  const [handoffStateApplied, setHandoffStateApplied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowHandoffDebug(isImageStudioHandoffDebugEnabled(window.location.search));
  }, []);

  // Durable recovery is independent of localStorage/window.name. Once the
  // production migration is applied, reopening Image Studio restores the most
  // recent unfinished confirmed job for this workspace.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const projectsResponse = await fetch("/api/image/production-projects", {
          cache: "no-store",
        });
        if (!projectsResponse.ok) return;
        const projectsPayload = (await projectsResponse.json()) as {
          projects?: Array<{ id: string }>;
        };
        const latest = projectsPayload.projects?.[0];
        if (!latest) return;
        const jobsResponse = await fetch(
          `/api/image/generation-jobs?productionProjectId=${encodeURIComponent(latest.id)}`,
          { cache: "no-store" },
        );
        if (!jobsResponse.ok) return;
        const jobsPayload = (await jobsResponse.json()) as {
          jobs?: ImageGenerationJobView[];
        };
        const unfinished = jobsPayload.jobs?.find((job) =>
          [
            "awaiting_confirmation",
            "confirmed",
            "running",
            "failed",
            "unknown_outcome",
          ].includes(job.status),
        );
        if (!cancelled && unfinished) setPaidJob(unfinished);
      } catch {
        // Migration may be intentionally unapplied. Local planning UI remains
        // available, but durable production is correctly unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!paidJob || paidJob.status !== "running") return;
    const timer = window.setInterval(() => {
      void fetch(`/api/image/generation-jobs/${paidJob.id}`, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { job?: ImageGenerationJobView } | null) => {
          if (payload?.job) setPaidJob(payload.job);
        })
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paidJob]);

  useEffect(() => {
    if (!paidJob || paidJob.status !== "succeeded") return;
    void fetch(
      `/api/image/production-projects/${paidJob.productionProjectId}/assets`,
      { cache: "no-store" },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { assets?: ImageProductionAssetView[] } | null) => {
        if (payload?.assets) setDurableAssets(payload.assets);
      })
      .catch(() => undefined);
  }, [paidJob]);

  const reviewDurableAsset = useCallback(
    async (assetId: string, reviewStatus: "APPROVED" | "REJECTED") => {
      setPaidJobBusy(true);
      try {
        const response = await fetch(
          `/api/image/production-assets/${assetId}/review`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewStatus, note: null }),
          },
        );
        const payload = (await response.json()) as {
          asset?: Omit<ImageProductionAssetView, "accessUrl" | "accessExpiresAt">;
          error?: string;
        };
        if (!response.ok || !payload.asset) {
          throw new Error(payload.error ?? "Die Ergebnisprüfung ist fehlgeschlagen.");
        }
        setDurableAssets((current) =>
          current.map((asset) =>
            asset.id === assetId
              ? { ...asset, ...payload.asset }
              : asset,
          ),
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Die Ergebnisprüfung ist fehlgeschlagen.");
      } finally {
        setPaidJobBusy(false);
      }
    },
    [],
  );

  const handleBrandModelSelection = useCallback(
    (selection: ImageBrandModelSelection | null) => {
      const previousTrace = brandModelSelection?.productionContext.trace;
      const nextTrace = selection?.productionContext.trace;
      const projectTrace = cachedProductionProject?.brandModelContext?.trace;
      const selectionChanged =
        Boolean(previousTrace || nextTrace) &&
        !productionProjectMatchesBrandModel({
          projectBrandModelTrace: previousTrace ?? null,
          selectedTrace: nextTrace ?? null,
        });
      const projectStale =
        Boolean(nextTrace) &&
        Boolean(cachedProductionProject) &&
        !productionProjectMatchesBrandModel({
          projectBrandModelTrace: projectTrace,
          selectedTrace: nextTrace,
        });

      setBrandModelSelection(selection);
      setError(null);

      if (selectionChanged || projectStale) {
        clearCachedProductionProject();
        setResult(null);
        setProductionAssets([]);
      }
    },
    [brandModelSelection],
  );

  const handleProductSelectionChange = useCallback((selection: ImageProductSelection | null) => {
    if (!selection) {
      setImageProductSelection(null);
      setProductSelection(null);
      setProductProductionContext(null);
      setSelectedProductLabel(null);
      return;
    }
    setImageProductSelection(selection);
    setProductSelection(selection.selection);
    setProductProductionContext(selection.productionContext);
    const context = selection.productionContext;
    setSelectedProductLabel(
      `${context.productName} · ${context.color ?? "Variante"} · ${context.size ?? "Größe"}`,
    );
  }, []);

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

  useEffect(() => {
    if (!paidJob) return;
    const staleReason = resolvePaidJobStaleReason({
      paidJob,
      selectedAssetId: selectedAsset?.id ?? selectedAssetId,
      handoff,
      brandModelSelection,
      productProductionContext,
    });
    if (!staleReason) return;
    setPaidJob(null);
    setError(staleReason);
  }, [
    paidJob,
    selectedAsset?.id,
    selectedAssetId,
    handoff,
    brandModelSelection,
    productProductionContext,
  ]);

  const blueprint = useMemo(
    () => resolveImportedBlueprint(projectContextHandoff, result?.projectName),
    [projectContextHandoff, result?.projectName],
  );

  const effectiveBrief = useMemo(
    () => resolveGenerationBrief(brief, handoff, projectContextHandoff, blueprint),
    [brief, handoff, projectContextHandoff, blueprint],
  );

  const canStartGeneration = effectiveBrief.trim().length >= 3;
  const canPrepareEstimate = canPreparePaidImageEstimate({
    briefReady: canStartGeneration,
    productContext: productProductionContext,
    masterArtworkApproved: Boolean(
      handoff?.masterArtworkApproved || handoff?.durableMasterArtwork,
    ),
    hasBrandModel: Boolean(brandModelSelection),
  });
  const prepareEstimateBlocker = resolvePrepareEstimateBlocker({
    briefReady: canStartGeneration,
    productContext: productProductionContext,
    masterArtworkApproved: Boolean(
      handoff?.masterArtworkApproved || handoff?.durableMasterArtwork,
    ),
    hasBrandModel: Boolean(brandModelSelection),
  });
  const productHeader = resolveImageStudioProductHeader({
    productContext: productProductionContext,
    selectedProductLabel,
  });
  const artworkIdentity = useMemo(
    () =>
      resolveArtworkDisplayName({
        userFacingTitle: handoff?.durableMasterArtwork?.displayName,
        fileName:
          handoff?.artworkFileName ??
          handoff?.durableMasterArtwork?.originalFileName,
        durableDisplayName: handoff?.durableMasterArtwork?.designId,
        designId: handoff?.designId ?? handoff?.durableMasterArtwork?.designId,
        researchTitle: projectContextHandoff?.sourceTitle,
      }),
    [
      handoff?.artworkFileName,
      handoff?.designId,
      handoff?.durableMasterArtwork?.designId,
      handoff?.durableMasterArtwork?.displayName,
      handoff?.durableMasterArtwork?.originalFileName,
      projectContextHandoff?.sourceTitle,
    ],
  );
  const designMissionHints = resolveDesignMissionHints(blueprint);

  const hasBlueprint = Boolean(blueprint?.imported || brief.trim());
  const hasResults = productionAssets.length > 0;
  const hasArtworkHandoff = Boolean(handoff);
  const hasProjectContext = Boolean(projectContextHandoff || blueprint?.imported);
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
    handoff: hasProjectContext,
    hasBlueprint,
    imagePrompt: projectContextHandoff?.imagePromptPrimary ?? brief,
    mockupPrompt: projectContextHandoff?.mockupPromptPrimary,
    masterArtworkApproved: handoff?.masterArtworkApproved,
  });

  const projectContextTitle =
    blueprint?.designName ??
    projectContextHandoff?.sourceTitle ??
    "Kein Projektkontext vorhanden";
  const artworkVersionLabel = handoff?.durableMasterArtwork?.version ?? handoff?.masterArtworkVersion ?? "—";
  const artworkStatusLabel = resolveDurableMasterArtworkReference(handoff)
    ? "Freigegeben"
    : "Nicht ausgewählt";
  const artworkOriginalFileName =
    handoff?.artworkFileName ?? handoff?.durableMasterArtwork?.originalFileName ?? null;
  const artworkSecondaryLine = hasArtworkHandoff
    ? formatArtworkSecondaryLine({
        version: artworkVersionLabel !== "—" ? artworkVersionLabel : null,
        originalFileName: artworkOriginalFileName,
      }) || artworkStatusLabel
    : "Wähle ein freigegebenes Artwork aus der Bibliothek";
  const version = blueprint?.version ?? (hasResults ? "V1" : "—");
  const commercialStatus = resolveCommercialStatus(blueprint);
  const isDraftGenerationMode = IMAGE_GENERATION.mode === "draft";
  const ownerGenerationModeLabel = isDraftGenerationMode
    ? "Generative Vorschau — Artwork kann verändert werden"
    : "Deterministisches Mockup";
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

  const createProductionPackage = useCallback(
    async (briefText: string): Promise<ImageRunResult | null> => {
      const text = briefText.trim();
      if (!text) {
        console.warn("[Image Studio] createProductionPackage skipped — empty brief");
        return null;
      }

      if (cachedProductionProject) {
        const cachedTrace = cachedProductionProject.brandModelContext?.trace;
        const selectedTrace = brandModelSelection?.productionContext.trace;
        const sameIdentityVersion =
          (!cachedTrace && !selectedTrace) ||
          (cachedTrace != null &&
            selectedTrace != null &&
            cachedTrace.contractVersion === selectedTrace.contractVersion &&
            cachedTrace.brandModelId === selectedTrace.brandModelId &&
            cachedTrace.personaId === selectedTrace.personaId &&
            cachedTrace.identityLockSnapshotId ===
              selectedTrace.identityLockSnapshotId &&
            cachedTrace.identityLockVersion ===
              selectedTrace.identityLockVersion &&
            cachedTrace.identityFingerprint ===
              selectedTrace.identityFingerprint &&
            cachedTrace.referencePackageVersion ===
              selectedTrace.referencePackageVersion &&
            cachedTrace.referencePackageFingerprint ===
              selectedTrace.referencePackageFingerprint);
        if (!sameIdentityVersion) {
          cachedProductionProject = null;
          productionPackagePromise = null;
        }
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
        setValidationDebug(null);

        try {
          console.info("[Image Studio] creating production package", { briefLength: text.length });
          const res = await fetch("/api/image/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brief: text,
              productName: projectContextHandoff?.mission?.garment,
              collectionName: projectContextHandoff?.mission?.collection,
              color: projectContextHandoff?.mission?.colorway,
              material:
                productProductionContext?.authoritative !== true
                  ? productProductionContext?.material ?? undefined
                  : undefined,
              ...(brandModelSelection
                ? {
                    brandModelSelection:
                      brandModelSelection.productionContext.trace,
                  }
                : {}),
            }),
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
          const enrichedAssets = enrichProductionAssetsWithMasterArtwork(
            project.productionAssets ?? [],
            handoff,
          );
          const enrichedProject = { ...project, productionAssets: enrichedAssets };
          cachedProductionProject = enrichedProject;
          setResult(enrichedProject);
          setProductionAssets(enrichedAssets);
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
    [brandModelSelection, handoff, projectContextHandoff, productProductionContext, t],
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

    const briefForRun = resolveGenerationBrief(
      brief,
      handoff,
      projectContextHandoff,
      blueprint,
    );
    if (!briefForRun.trim()) {
      console.warn("[Image Studio] runImage early return: missing brief", {
        abortReason: "missing brief",
      });
      setError(
        "Produktion kann nicht starten: Es fehlt ein Briefing, Prompt oder eine Design-Übergabe.",
      );
      return null;
    }

    if (!handoff && !projectContextHandoff && !blueprint && !brief.trim()) {
      console.warn("[Image Studio] runImage early return: missing handoff", {
        abortReason: "missing handoff",
      });
      setError("Produktion kann nicht starten: Die Design-Übergabe wurde nicht übernommen.");
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
          "Das Produktionspaket konnte nicht erstellt werden. Prüfe die Fehlermeldung oben.",
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
      setError("Das Produktionspaket enthält keine Aufnahme für die Generierung.");
      return project;
    }

    const pendingAssets = queuedAssetsForPipeline(assets);
    if (pendingAssets.length === 0) {
      console.info("[Image Studio] runImage: no pending assets in queue", {
        reportId: project.reportId,
        assetCount: assets.length,
      });
      setError(
        "Alle Aufnahmen sind bereits erstellt. Wähle eine Aufnahme, um sie erneut zu erzeugen.",
      );
      return project;
    }

    if (pipelineLockRef.current) {
      console.warn("[Image Studio] runImage resetting stuck pipelineLockRef before pipeline", {
        abortReason: "pipelineLockRef.current is true",
      });
      pipelineLockRef.current = false;
    }

    const assetToPrepare =
      pendingAssets.find((asset) => asset.id === selectedAsset?.id) ?? pendingAssets[0];

    if (!handoff?.masterArtworkApproved && !handoff?.durableMasterArtwork) {
      setError("Vor der Vorbereitung ist ein freigegebenes Master Artwork erforderlich.");
      return project;
    }
    const prepareBlocker = resolvePrepareEstimateBlocker({
      briefReady: briefForRun.trim().length >= 3,
      productContext: productProductionContext,
      masterArtworkApproved: Boolean(
        handoff?.masterArtworkApproved || handoff?.durableMasterArtwork,
      ),
      hasBrandModel: Boolean(brandModelSelection),
    });
    if (prepareBlocker) {
      setError(prepareBlocker);
      return project;
    }
    if (!productSelection || !productProductionContext || productProductionContext.authority !== "SHOPIFY_LIVE") {
      setError(
        "Wähle vor der Kostenprüfung ein verifiziertes Shopify-Produkt. Design-Hinweise sind keine verbindliche Produktquelle.",
      );
      return project;
    }

    const selectedTrace = brandModelSelection?.productionContext.trace ?? null;
    if (
      selectedTrace &&
      !productionProjectMatchesBrandModel({
        projectBrandModelTrace: project.brandModelContext?.trace,
        selectedTrace,
      })
    ) {
      console.info("[Image Studio] re-staging production package for selected Brand Model", {
        reportId: project.reportId,
      });
      clearCachedProductionProject();
      const restaged = await createProductionPackage(briefForRun);
      if (!restaged) {
        setError("Das Produktionspaket konnte mit dem gewählten Markenmodel nicht neu vorbereitet werden.");
        return null;
      }
      project = restaged;
      setResult(restaged);
      setProductionAssets(restaged.productionAssets ?? []);
    }

    const identityBlocker = resolvePaidPrepareIdentityBlocker({
      handoff,
      brandModelSelection,
      projectBrandModelTrace: project.brandModelContext?.trace,
    });
    if (identityBlocker) {
      setError(identityBlocker);
      return project;
    }

    const trace = resolveBrandModelTraceForPrepare({
      brandModelSelection,
      projectBrandModelTrace: project.brandModelContext?.trace,
    });
    const durableReference = resolveDurableMasterArtworkReference(handoff);
    if (!trace || !durableReference) {
      setError("Artwork-Freigabe oder Markenmodel-Herkunft konnten nicht eindeutig bestätigt werden.");
      return project;
    }

    setPaidJobBusy(true);
    try {
      const response = await fetch("/api/image/generation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportRecordId: project.reportRecordId,
          reportId: project.reportId,
          assetId: assetToPrepare.id,
          provider: "openai",
          brandModelTrace: trace,
          masterArtwork: {
            reference: durableReference,
          },
          product: productSelection,
        }),
      });
      const data = (await response.json()) as {
        job?: ImageGenerationJobView;
        error?: string;
        details?: unknown;
      };
      if (!response.ok || !data.job) {
        const raw =
          data.error ??
          (data.details ? JSON.stringify(data.details) : "Die Vorbereitung der Bildgenerierung ist fehlgeschlagen.");
        logPaidPrepareValidationError(raw, { status: response.status });
        throw new Error(formatPaidPrepareError(raw));
      }
      setPaidJob(data.job);
      setError(null);
    } catch (cause) {
      const raw =
        cause instanceof Error ? cause.message : "Die Vorbereitung der Bildgenerierung ist fehlgeschlagen.";
      logPaidPrepareValidationError(raw);
      setError(formatPaidPrepareError(raw));
    } finally {
      setPaidJobBusy(false);
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
    selectedAsset,
    brandModelSelection,
    productProductionContext,
    productSelection,
    t,
  ]);

  const generateAssetsButtonLabel = paidJobBusy
    ? "Kosten werden geprüft…"
    : pipelineActive || generatingAssetId
    ? "Bild wird erstellt…"
    : isLoading
      ? "Referenzen werden vorbereitet…"
      : "Generative Vorschau · Kosten prüfen";

  const actOnPaidJob = useCallback(async (action: "confirm" | "execute" | "retry_known_failure" | "cancel") => {
    if (!paidJob) return;
    setPaidJobBusy(true);
    try {
      const response = await fetch(`/api/image/generation-jobs/${paidJob.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, inputFingerprint: paidJob.inputFingerprint }),
      });
      const data = (await response.json()) as { job?: ImageGenerationJobView; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error ?? "Die Bildaktion ist fehlgeschlagen.");
      setPaidJob(data.job);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Bildaktion ist fehlgeschlagen.");
    } finally { setPaidJobBusy(false); }
  }, [paidJob]);

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
      if (cachedProjectContextHandoff) {
        setProjectContextHandoff(cachedProjectContextHandoff);
      }
      if (!cachedAppliedArtworkHandoff) return false;
      setHandoff(cachedAppliedArtworkHandoff);
      setBrief(
        cachedProjectContextHandoff?.brief ??
          cachedAppliedArtworkHandoff.brief,
      );
      setHandoffStateApplied(true);
      return true;
    };

    const tryApplyHandoff = (attemptLabel: string) => {
      if (cancelled) return;

      const { handoff: normalized, debug } = applyImageStudioHandoff();
      setHandoffLoadDebug(debug);

      if (handoffBootstrapLock && cachedAppliedArtworkHandoff) {
        const cachedArtworkKey =
          cachedAppliedArtworkHandoff.durableMasterArtwork?.checksum ??
          cachedAppliedArtworkHandoff.handoffAt;
        const bootstrapped = bootstrapImageStudioHandoff(normalized);
        const freshArtworkKey =
          bootstrapped.artworkHandoff?.durableMasterArtwork?.checksum ??
          normalized?.handoffAt;
        if (
          bootstrapped.artworkHandoff &&
          freshArtworkKey &&
          cachedArtworkKey &&
          freshArtworkKey !== cachedArtworkKey
        ) {
          console.info("[Image Studio] replacing cached handoff with newer Design authority", {
            attempt: attemptLabel,
          });
          handoffBootstrapLock = false;
          clearCachedProductionProject();
          setResult(null);
          setProductionAssets([]);
          setPaidJob(null);
        } else {
          if (restoreCachedHandoff()) {
            console.info("[Image Studio] handoff restored from cache", { attempt: attemptLabel });
          }
          hydrateCachedProductionPackage();
          return;
        }
      } else if (handoffBootstrapLock) {
        if (restoreCachedHandoff()) {
          console.info("[Image Studio] handoff restored from cache", { attempt: attemptLabel });
        }
        hydrateCachedProductionPackage();
        return;
      }

      console.info("[Image Studio] handoff raw loaded", {
        attempt: attemptLabel,
        rawFound: debug.rawFound,
        source: debug.source,
        parsed: debug.parsed,
        rejectReason: debug.rejectReason,
      });

      const bootstrapped = bootstrapImageStudioHandoff(normalized);
      if (!normalized && !bootstrapped.projectContextHandoff) {
        console.info("[Image Studio] handoff not present or invalid", debug.rejectReason);
        setHandoffStateApplied(true);
        return;
      }

      if (bootstrapped.artworkRejectReason && !bootstrapped.artworkHandoff) {
        console.info("[Image Studio] artwork authority ignored", {
          reason: bootstrapped.artworkRejectReason,
        });
      }

      handoffBootstrapLock = true;
      cachedAppliedArtworkHandoff = bootstrapped.artworkHandoff;
      cachedProjectContextHandoff = bootstrapped.projectContextHandoff;

      setHandoff(bootstrapped.artworkHandoff);
      setProjectContextHandoff(bootstrapped.projectContextHandoff);
      setBrief(
        bootstrapped.projectContextHandoff?.brief ??
          bootstrapped.artworkHandoff?.brief ??
          "",
      );
      setHandoffStateApplied(true);

      if (bootstrapped.artworkHandoff) {
        console.info("[Image Studio] explicit artwork authority applied", {
          designId:
            bootstrapped.artworkHandoff.designId ??
            bootstrapped.artworkHandoff.durableMasterArtwork?.designId,
          durableArtworkId: bootstrapped.artworkHandoff.durableMasterArtwork?.id,
          version: bootstrapped.artworkHandoff.durableMasterArtwork?.version,
          source: bootstrapped.artworkSource,
        });
      }

      if (bootstrapped.projectContextHandoff) {
        console.info("[Image Studio] project context retained (non-authoritative)", {
          title:
            bootstrapped.projectContextHandoff.mission?.title ??
            bootstrapped.projectContextHandoff.sourceTitle,
          reportId: bootstrapped.projectContextHandoff.reportId,
        });
      }

      if (bootstrapped.shouldClearStorage) {
        acknowledgeImageStudioHandoff();
      }
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

    const missionBrief = resolveGenerationBrief(
      brief,
      handoff,
      projectContextHandoff,
      blueprint,
    );
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
    projectContextHandoff,
    brief,
    blueprint,
    createProductionPackage,
    productionAssets.length,
  ]);

  const generateSingleAsset = useCallback(
    async (asset: ImageStudioAsset) => {
      if (!result || generatingAssetId || pipelineActive) return;
      setSelectedAssetId(asset.id);
      setError("Aufnahme ausgewählt. Prüfe sie und wähle anschließend „Vorbereiten & Kosten prüfen“.");
    },
    [generatingAssetId, pipelineActive, result],
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
    selectedAsset?.prompt.openai ??
    blueprint?.imagePrompt ??
    projectContextHandoff?.imagePromptPrimary ??
    brief;

  const printReadiness =
    projectContextHandoff?.concept?.productionNotes?.printReadiness?.join(", ") ??
    "Noch nicht geprüft";

  const versionTimeline = [
    {
      version: blueprint?.version ?? "V1",
      label: "Design-Hinweise übernommen",
      time: projectContextHandoff?.handoffAt
        ? new Date(projectContextHandoff.handoffAt).toLocaleString("de-DE")
        : "—",
    },
    ...(hasResults ? [{ version: "V1.0", label: "Produktionspaket erstellt", time: "Projekt vorbereitet" }] : []),
    ...(selectedAsset?.createdAt
      ? [{ version: assetVersionLabel(selectedAsset), label: ownerShotLabel(selectedAsset.title ?? "Ergebnis"), time: new Date(selectedAsset.createdAt).toLocaleString("de-DE") }]
      : []),
  ];

  return (
    <div className="is-root nx-studio">
      <header className="is-topbar">
        <nav className="is-breadcrumbs" aria-label="Brotkrümelnavigation">
          <Link href="/" className="is-crumb">
            <Home className="size-3.5" />
            NexHQ
          </Link>
          <span className="is-crumb-sep" aria-hidden>›</span>
          <span className="is-crumb is-crumb-current">
            <Palette className="size-3.5" />
            Image Studio
          </span>
        </nav>
      </header>

      <header className="is-hero-mission">
        <div className="is-hero-mission-primary">
          <p className="nx-page-header__eyebrow">Bildproduktion</p>
          <h1 className="is-hero-title">Image Studio</h1>
          <p className="is-hero-subtitle">Mockups und Kampagnenbilder aus Artwork, Produkt und Markenmodel erstellen.</p>
        </div>
        <span className="nx-status nx-status--success">Deterministisches Mockup · Produktion</span>
      </header>

      <details className="is-project-context">
        <summary>Projektkontext und Design-Hinweise</summary>
        <div className="is-project-context__body">
          <p><strong>Herkunft:</strong> {projectContextTitle}</p>
          <div className="is-hero-meta-row">
          <HeroMeta
            label="Produkt"
            value={productHeader.value}
            highlight={productHeader.authoritative ? "emerald" : undefined}
          />
          <HeroMeta label="Produktquelle" value={ownerAuthorityLabel(productHeader.authorityLabel)} />
          <HeroMeta label="Artwork-Version" value={version} />
          <HeroMeta label="Kommerzieller Status" value={commercialStatus} highlight="gold" />
          <HeroMeta
            label="Produktionsmodus"
            value={ownerGenerationModeLabel}
            highlight={isDraftGenerationMode ? "gold" : "emerald"}
          />
          <HeroMeta label="Produktionsstatus" value={generationStatus} highlight={pipelineActive || generatingAssetId ? "emerald" : hasResults ? "gold" : undefined} />
          </div>
          {designMissionHints ? (
            <p className="is-hero-design-hints">
              Nicht verbindliche Design-Hinweise: {designMissionHints.collection} ·{" "}
              {designMissionHints.garment} · {designMissionHints.colorway}. Die echte Produktauswahl erfolgt unten.
            </p>
          ) : null}
          {isResearchReportTitle(projectContextHandoff?.sourceTitle) ||
          isResearchReportTitle(projectContextHandoff?.mission?.title) ? (
            <p className="is-hero-design-hints">{RESEARCH_ARTWORK_PROVENANCE}</p>
          ) : null}
        </div>
      </details>

      <details className="is-v1-preview">
        <summary>Generative Vorschau · Artwork kann verändert werden</summary>
        <div className="is-v1-preview__body">
          <p className="is-v1-preview__warning">Nur für kreative Entwürfe. Für artworkgetreue Produktion das deterministische Mockup verwenden.</p>
        <div className="is-toolbar">
        <button
          type="button"
          className="is-toolbar-primary"
          onClick={handleGenerateAssetsClick}
          disabled={isLoading || pipelineActive || !canPrepareEstimate}
        >
          <Sparkles className="size-4" />
          {generateAssetsButtonLabel}
        </button>
        <div className="is-toolbar-divider" aria-hidden />
        <div className="is-toolbar-secondary">
          <ToolbarGhost disabled={!hasResults}>Varianten</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Hero</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Kampagne</ToolbarGhost>
          <ToolbarGhost disabled={!selectedAsset?.imageUrl}>Vergrößern</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Exportieren</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>
            <Download className="size-3.5" />
            ZIP
          </ToolbarGhost>
        </div>
        <div className="is-toolbar-divider" aria-hidden />
        <div className="is-toolbar-secondary is-toolbar-secondary--muted">
          <ToolbarGhost disabled={!hasResults}>Kommerziell</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Marketing</ToolbarGhost>
          <ToolbarGhost disabled={!hasResults}>Shopify</ToolbarGhost>
        </div>
      </div>
        </div>
      </details>

      {prepareEstimateBlocker && hasArtworkHandoff ? (
        <div className="is-error-banner is-error-banner--muted">
          <p className="is-error-banner__summary">{prepareEstimateBlocker}</p>
        </div>
      ) : null}

      {error ? (
        <div className="is-error-banner">
          <p className="is-error-banner__summary">{error.split("\n\n")[0]}</p>
          {validationDebug ? (
            <details className="nx-technical"><summary>Technische Details</summary><div className="is-error-banner__debug nx-technical__body">
              {validationDebug.schemaName ? (
                <p className="is-error-banner__schema">
                  Schema: <code>{validationDebug.schemaName}</code>
                </p>
              ) : null}
              {validationDebug.missingFields?.length ? (
                <p className="is-error-banner__missing">
                  Fehlende Felder: {validationDebug.missingFields.join(", ")}
                </p>
              ) : null}
              {validationDebug.validationIssues?.length ? (
                <ul className="is-error-banner__issues">
                  {validationDebug.validationIssues.map((issue) => (
                    <li key={`${issue.path}-${issue.message}`}>
                      <span className="is-error-banner__issue-path">❌ {issue.path}</span>
                      <dl className="is-error-banner__issue-detail">
                        <div>
                          <dt>Feld</dt>
                          <dd>{issue.field}</dd>
                        </div>
                        <div>
                          <dt>Erwartet</dt>
                          <dd>{issue.expected}</dd>
                        </div>
                        <div>
                          <dt>Erhalten</dt>
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
                          <dt>Pfad</dt>
                          <dd>{issue.path}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div></details>
          ) : null}
        </div>
      ) : null}

      <section className="is-v2-inputs" aria-label="Produktionsauswahl">
        <div className="is-v2-input-card">
          <span className="is-v2-input-number">01</span><div><p>Artwork</p><strong>{hasArtworkHandoff ? artworkIdentity.displayName : "Kein Artwork ausgewählt"}</strong><span>{artworkSecondaryLine}</span></div>
          {!hasArtworkHandoff ? <Link href="/agents/design" className="nx-button">Artwork auswählen</Link> : null}
        </div>
        <div className="is-v2-input-card is-v2-input-card--form"><span className="is-v2-input-number">02–03</span><ProductProductionSelector onSelectionChange={handleProductSelectionChange} /></div>
        <div className="is-v2-input-card is-v2-input-card--form"><span className="is-v2-input-number">04</span><BrandModelSelector onSelectionChange={handleBrandModelSelection} /></div>
        <div className="is-v2-input-card"><span className="is-v2-input-number">06</span><div><p>Aufnahme</p><strong>{ownerShotLabel(selectedAsset?.title ?? selectedSlot.label)}</strong><span>Genau eine Aufnahme ist für den nächsten Auftrag ausgewählt.</span></div></div>
      </section>

      <DeterministicV2Panel
        reportRecordId={result?.reportRecordId ?? null}
        reportId={result?.reportId ?? null}
        assetId={selectedAsset?.id ?? null}
        brandModelTrace={brandModelSelection?.productionContext.trace ?? null}
        masterArtwork={resolveDurableMasterArtworkReference(handoff)}
        shopifyProductId={productSelection?.authority === "SHOPIFY_LIVE" ? productSelection.productId : null}
        shopifyVariantId={productSelection?.authority === "SHOPIFY_LIVE" ? productSelection.variantId : null}
        productProfile={imageProductSelection?.productProfile ?? null}
      />

      {paidJob ? (
        <details className="is-v1-preview" aria-label="Generative Vorschau">
          <summary>Gespeicherter generativer Entwurf · {ownerStatusLabel(paidJob.status)}</summary>
          <div className="is-v1-preview__body">
            <h3 className="is-panel-heading">Generative Vorschau — Artwork kann verändert werden</h3>
            <p>Dieser historische Modus kann Typografie, Logos, Farben oder Layout generativ verändern. Für freigegebene Artworks ausschließlich das deterministische Mockup verwenden.</p>
            <p><strong>Markenmodel:</strong> {paidJob.inputSnapshot.brandModel.displayName}</p>
            <p><strong>Artwork:</strong> {artworkIdentity.displayName} · Version {paidJob.inputSnapshot.masterArtwork.version}</p>
            <p><strong>Produkt:</strong> {paidJob.inputSnapshot.product.productName} · {paidJob.inputSnapshot.product.color} · {ownerAuthorityLabel(paidJob.inputSnapshot.product.authority)}</p>
            <p><strong>Aufnahme:</strong> {ownerShotLabel(paidJob.inputSnapshot.production.shotTitle)}</p>
            <p><strong>Geschätztes Maximum:</strong> {paidJob.estimate.maximum.toFixed(4)} {paidJob.estimate.currency}</p>
            <p><strong>Status:</strong> {ownerStatusLabel(paidJob.status)}</p>
            <p><strong>Bestätigung gültig bis:</strong> {new Date(paidJob.confirmationExpiresAt).toLocaleString("de-DE")}</p>
            {paidJob.status === "awaiting_confirmation" ? <p>Mit der Bestätigung autorisierst du genau diesen generativen Entwurfsversuch zum angezeigten Kostenmaximum.</p> : null}
            <div className="is-staging-actions">
              {paidJob.status === "awaiting_confirmation" ? <button type="button" className="is-btn is-btn--primary" disabled={paidJobBusy} onClick={() => void actOnPaidJob("confirm")}>Generativen Entwurf bestätigen</button> : null}
              {paidJob.status === "confirmed" ? <button type="button" className="is-btn is-btn--primary" disabled={paidJobBusy} onClick={() => void actOnPaidJob("execute")}>Entwurf generieren</button> : null}
              {paidJob.status === "failed" && paidJob.safeRetryAllowed ? <button type="button" className="is-btn is-btn--primary" disabled={paidJobBusy} onClick={() => void actOnPaidJob("retry_known_failure")}>Sicheren Versuch wiederholen</button> : null}
              {["awaiting_confirmation", "confirmed", "failed"].includes(paidJob.status) ? <button type="button" className="is-btn" disabled={paidJobBusy} onClick={() => void actOnPaidJob("cancel")}>Abbrechen</button> : null}
              {paidJob.status === "unknown_outcome" ? <p>Das Provider-Ergebnis ist unbekannt. Nicht erneut versuchen, bevor der Auftrag abgeglichen wurde.</p> : null}
            </div>
            {durableAssets.length ? (
              <div>
                <h4>Ergebnis prüfen</h4>
                {durableAssets.map((asset) => (
                  <div key={asset.id}>
                    <p>
                      <strong>{ownerShotLabel(asset.shotId)}</strong> · {ownerStatusLabel(asset.reviewStatus)}
                    </p>
                    {asset.accessUrl ? (
                      <a href={asset.accessUrl} target="_blank" rel="noreferrer">
                        Private Vorschau öffnen
                      </a>
                    ) : (
                      <p>Private Vorschau nicht verfügbar oder abgelaufen. Lade die Seite neu.</p>
                    )}
                    <div className="is-staging-actions">
                      <button type="button" className="is-btn is-btn--primary" disabled={paidJobBusy} onClick={() => void reviewDurableAsset(asset.id, "APPROVED")}>Asset freigeben</button>
                      <button type="button" className="is-btn" disabled={paidJobBusy} onClick={() => void reviewDurableAsset(asset.id, "REJECTED")}>Asset ablehnen</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <details className="nx-technical">
              <summary>Technische Details</summary>
              <div className="nx-technical__body">
                <p>Identity Lock: v{paidJob.inputSnapshot.brandModel.identityLockVersion}</p>
                <p>Design-ID: <code>{paidJob.inputSnapshot.masterArtwork.designId}</code></p>
                <p>Provider/Modell: <code>{paidJob.inputSnapshot.production.provider}/{paidJob.inputSnapshot.production.model}</code></p>
                <p>Fingerprint: <code>{paidJob.inputFingerprint}</code></p>
                <p>Interner Status: <code>{paidJob.status}</code></p>
              </div>
            </details>
          </div>
        </details>
      ) : null}

      <details className="is-legacy-workspace">
        <summary>Weitere Aufnahmen und ältere Werkzeuge</summary>
      <div className="is-body">
        <aside className="is-sidebar">
          <div className="is-sidebar-header">
            <h2 className="is-sidebar-title">Aufnahmen</h2>
            <p className="is-sidebar-sub">Eine Aufnahme wählen · ein Auftrag erzeugt genau ein Ergebnis</p>
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
                  garmentLabel={productHeader.authoritative ? productHeader.value : "Produkt noch nicht ausgewählt"}
                />

                <div className="is-staging-panel">
                  {hasProjectContext && blueprint ? (
                    <>
                      <div className="is-handoff-checklist">
                        <h3 className="is-panel-heading">Produktionsgrundlage</h3>
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
                          disabled={isLoading || pipelineActive || !canPrepareEstimate}
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
                        <h2 className="is-empty-headline">Produktionsgrundlage fehlt</h2>
                        <p className="is-handoff-empty-text">
                          Wähle ein freigegebenes Artwork aus der Artwork-Bibliothek, um die Bildproduktion zu beginnen.
                        </p>
                        <Link href="/agents/design" className="is-btn is-btn--primary is-btn--cta">
                          Artwork im Design Studio wählen
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
            <h2 className="is-inspector-title">Produktion</h2>
            <p className="is-inspector-asset">{ownerShotLabel(selectedAsset?.title ?? selectedSlot.label)}</p>
          </div>

          <div className="is-inspector-actions">
            <button type="button" className="is-inspector-action is-inspector-action--primary" disabled={!selectedAsset?.imageUrl} onClick={() => selectedAsset && setApproved((p) => new Set(p).add(selectedAsset.id))}>
              Freigeben
            </button>
            <button type="button" className="is-inspector-action" disabled={!selectedAsset} onClick={() => selectedAsset && void generateSingleAsset(selectedAsset)}>
              Neu versuchen
            </button>
            <button type="button" className="is-inspector-action" disabled={!selectedAsset?.imageUrl}>Vergrößern</button>
            <button type="button" className="is-inspector-action" disabled={!selectedAsset?.imageUrl}>Hintergrund entfernen</button>
            <button type="button" className="is-inspector-action" disabled={!selectedAsset}>Varianten</button>
          </div>

          <div className="is-inspector-cards">
            <InspectorCard
              title="Aktive Aufnahme"
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
                    <span className="is-queue-name">{ownerShotLabel(slot.label)}</span>
                    <span className="is-queue-status">{MISSION_STATUS_LABELS[status]}</span>
                  </div>
                );
              })}
            </InspectorCard>

            <InspectorCard
              title="Produkt & Variante"
              open={openSections.product}
              onToggle={() => toggleSection("product")}
            >
              <p>{productSelection ? `${selectedProductLabel ?? "Produkt"} · genaue Variante gewählt` : "Noch kein Produkt ausgewählt."}</p>
            </InspectorCard>

            <InspectorCard
              title="Markenmodel"
              open={openSections.model}
              onToggle={() => toggleSection("model")}
            >
              <p>{brandModelSelection ? `${brandModelSelection.productionContext.contract.displayName} · für Bilder freigegeben` : "Noch kein Markenmodel ausgewählt."}</p>
              {brandModelSelection ? (
                <InspectorField
                  label="Identität"
                  value={`v${brandModelSelection.productionContext.trace.identityLockVersion} · ${brandModelSelection.productionContext.trace.identityLockSnapshotId.slice(0, 8)}`}
                  mono
                />
              ) : null}
              <div className="is-model-badge">
                <span className="is-model-badge-provider">OpenAI Bildmodell</span>
                <span className="is-model-badge-model">Details unter „Technische Details“</span>
              </div>
              <InspectorField label="Produktionsmodus" value={ownerGenerationModeLabel} />
              <InspectorField label="Auflösung" value={selectedAsset?.dimensions ?? "1024 × 1024"} />
              <InspectorField label="Seed" value={selectedAsset?.id?.slice(0, 10) ?? "—"} mono />
              <InspectorField
                label="Erstellungsdauer"
                value={
                  selectedAsset
                    ? formatAssetElapsedTime(assetTimers[selectedAsset.id]?.elapsedMs)
                    : "—"
                }
              />
            </InspectorCard>

            <InspectorCard
              title="Technische Details · Prompt"
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
              title="Produktionsfortschritt"
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
              title="Kommerzielle Prüfung"
              open={openSections.review}
              onToggle={() => toggleSection("review")}
            >
              <div className="is-score-cards">
                <ScoreCard label="Kommerziell" value={commercialScore ?? "—"} unit={commercialScore != null ? "%" : ""} accent="emerald" />
                <ScoreCard label="Markenwirkung" value={commercialScore != null ? Math.min(99, commercialScore + 2) : "—"} unit={commercialScore != null ? "%" : ""} accent="gold" />
                <ScoreCard label="Produktionsbereit" value={hasResults ? "Vorbereitet" : "Ausstehend"} accent="muted" />
              </div>
              <InspectorField label="Produktionsreife" value={printReadiness} />
              <InspectorField label="Prüfung der Design-Hinweise" value={blueprint?.blueprintReview ?? "—"} />
            </InspectorCard>

            <InspectorCard
              title="Versionsverlauf"
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
      </details>

      {showHandoffDebug ? (
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
          { label: "master source", value: handoff?.masterArtworkSourceType ?? "—" },
          { label: "master version", value: handoff?.masterArtworkVersion ?? "—" },
          { label: "master dpi", value: handoff?.masterArtworkDpi != null ? String(handoff.masterArtworkDpi) : "—" },
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
      ) : null}
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
        <span className="is-blueprint-summary-label">Design-Hinweise (nicht verbindlich)</span>
        <p className="is-blueprint-summary-text">
          {blueprint.collection} · {blueprint.garment} · {blueprint.colorway}
        </p>
      </div>
      <div className="is-blueprint-summary-row">
        <span className="is-blueprint-summary-label">Kreative Richtung</span>
        <p className="is-blueprint-summary-text">{blueprint.creativeDirection}</p>
      </div>
      <div className="is-blueprint-summary-grid">
        <div>
          <span className="is-blueprint-summary-label">Designgeschichte</span>
          <p>{blueprint.designStory}</p>
        </div>
        <div>
          <span className="is-blueprint-summary-label">Gestaltungssprache</span>
          <p>{blueprint.fashionLanguage}</p>
        </div>
        <div>
          <span className="is-blueprint-summary-label">Kommerzielle Absicht</span>
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
            <span className="is-asset-card-label">{ownerShotLabel(slot.label)}</span>
            {slot.commercial ? <span className="is-commercial-badge">COM</span> : null}
          </span>
          <span className="is-asset-card-meta">
            <span className={cn("is-asset-card-status", `is-asset-card-status--${status}`)}>
              <span className={cn("is-production-dot", `is-production-dot--${PRODUCTION_QUEUE_DOT[status]}`)} />
              {MISSION_STATUS_LABELS[status]}
              {status === "ready" ? <span className="is-asset-card-ready-tag">Bereit</span> : null}
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
          Generieren
        </button>
      ) : null}
    </li>
  );
}
