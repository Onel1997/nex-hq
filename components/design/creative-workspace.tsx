"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { CreativeDirectionsSidebar } from "@/components/design/creative-directions-sidebar";
import { CreativeDirectionsStage } from "@/components/design/creative-directions-stage";
import { DirectionCompareModal } from "@/components/design/direction-compare-modal";
import { DesignLabCollapse } from "@/components/design/design-lab-workspace";
import { MasterArtworkCanvas } from "@/components/design/master-artwork-canvas";
import { MasterArtworkInspector } from "@/components/design/master-artwork-inspector";
import { MasterArtworkLeftRail } from "@/components/design/master-artwork-left-rail";
import { MasterArtworkStage } from "@/components/design/master-artwork-stage";
import { StudioChrome, deriveWorkflowStep } from "@/components/design/studio-chrome";
import { StudioInspector } from "@/components/design/studio-inspector";
import {
  archiveDesignDirection,
  blendDesignDirections,
  buildDirectionBrief,
  clearDirectionCompare,
  duplicateDesignDirection,
  evolveDesignDirection,
  generateDesignDirections,
  regenerateDesignDirection,
  resolveCompareDirections,
  resolveSelectedDirection,
  selectDesignDirection,
  toggleDirectionCompare,
  type EvolutionAction,
} from "@/lib/design/design-directions";
import type {
  CollectionTimelineStage,
  DesignIteration,
  DesignMissionAssets,
  DesignMissionState,
  DesignPromptOverrides,
  PerDesignWorkspace,
  PipelineStage,
  ApprovalStatus,
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
import {
  extractGeneratedImageUrl,
  extractGeneratedSvg,
  readGenerationPayload,
  svgMarkupToDataUrl,
} from "@/lib/design/svg-data-url";
import {
  approveMasterArtworkState,
  buildAiDesignerMasterArtworkDraft,
  buildSvgDraftMasterArtwork,
  resolveMasterArtworkView,
} from "@/lib/design/master-artwork";
import { sanitizePrintArtworkSvg } from "@/lib/design/sanitize-print-artwork";
import { buildDesignMockupPayload } from "@/lib/design/mockup-request";
import { buildDesignRenderPayload } from "@/lib/design/render-request";
import { sendDesignHandoffToImageStudio, type HandoffSaveResult } from "@/lib/image/image-handoff-store";
import { HandoffDebugOverlay } from "@/components/image/handoff-debug-overlay";
import { MockModeBadge } from "@/components/design/mock-mode-badge";
import { useStudioMockMode } from "@/hooks/use-studio-mock-mode";
import {
  activateMockModeFromFailure,
  getMockModeActive,
} from "@/lib/design/studio-mock-mode";
import {
  buildMockMasterArtworkState,
  createMockAiDesignerConcept,
  generateMockDesignDirections,
  mockGenerationDelay,
} from "@/lib/design/studio-mock-data";
import { usePersistedCollapse } from "@/hooks/use-persisted-collapse";
import { cn } from "@/lib/utils";
import {
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
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
  Minus,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Send,
  Shapes,
  Sparkles,
  Stamp,
  Star,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useId,
  useState,
  type ReactNode,
} from "react";

type GarmentType = "tee" | "hoodie";

function resolveGarmentType(product: string): GarmentType {
  return /hoodie|sweat|pullover|zip/i.test(product) ? "hoodie" : "tee";
}

type CanvasTab = "concept" | "master" | "mockup" | "compare";
type ZoomLevel = 0.25 | 0.5 | 0.75 | 1 | 1.5 | "fit";

function resolveMasterArtworkPreviewUrl(assets: DesignMissionAssets): string | undefined {
  const state = assets.masterArtwork;
  return (
    state?.previewUrl ??
    state?.artworkImageUrl ??
    state?.approvedArtworkUrl ??
    state?.transparentPngUrl
  );
}

function resolveCanvasTab(assets: DesignMissionAssets): CanvasTab {
  if (resolveMasterArtworkPreviewUrl(assets)) return "master";
  if (assets.mockupUrl) return "mockup";
  if (assets.aiDesignerConcept) return "concept";
  return "concept";
}

function canvasTabForAssetKey(
  assetKey: "svgUrl" | "mockupUrl" | "renderUrl",
): CanvasTab {
  if (assetKey === "mockupUrl") return "mockup";
  if (assetKey === "renderUrl") return "mockup";
  return "master";
}

function isCanvasLayerGenerating(
  layer: "master" | "mockup",
  loading: string | null,
): boolean {
  if (!loading) return false;
  if (layer === "master") {
    return loading === "Generate Master Artwork" || loading === "Generate AI Design Concept";
  }
  return loading === "Generate Mockup";
}

function hasCanvasAsset(assets: PerDesignWorkspace["assets"]): boolean {
  return Boolean(
    assets.aiDesignerConcept ||
      resolveMasterArtworkPreviewUrl(assets) ||
      assets.mockupUrl,
  );
}

function countCanvasAssets(assets: DesignMissionAssets): number {
  return [
    assets.aiDesignerConcept,
    resolveMasterArtworkPreviewUrl(assets),
    assets.mockupUrl,
  ].filter(Boolean).length;
}

function getCommercialStatusLabel(
  assets: DesignMissionAssets,
  approvalStatus: ApprovalStatus,
): string {
  if (approvalStatus === "approved") return "Approved";
  if (approvalStatus === "revision") return "In Revision";
  if (approvalStatus === "archived") return "Archived";
  if (assets.commercialApproved) return "Commercial Ready";
  if (assets.commercialScore != null) return `Scored ${assets.commercialScore}%`;
  return "Pending Review";
}

type PipelineStepStatus = "complete" | "current" | "future";

const AI_PIPELINE_STEPS = [
  { id: "ceo", label: "CEO" },
  { id: "creative", label: "Creative Director" },
  { id: "research", label: "Research Director" },
  { id: "ai-designer", label: "AI Designer" },
  { id: "image-studio", label: "Image Studio" },
  { id: "commercial", label: "Commercial Director" },
  { id: "production", label: "Production" },
] as const;

function derivePipelineStepStates(
  assets: DesignMissionAssets,
  _approvalStatus: ApprovalStatus,
  pipelineStage: PipelineStage,
): Array<{ id: string; label: string; status: PipelineStepStatus }> {
  const hasConcept = Boolean(assets.aiDesignerConcept);
  const hasMasterArtwork = Boolean(resolveMasterArtworkPreviewUrl(assets));
  const masterApproved = resolveMasterArtworkView(assets).isApproved;
  const inProduction = pipelineStage === "shopify" || pipelineStage === "launch";

  let currentIndex = 3;
  if (!hasConcept) currentIndex = 3;
  else if (!hasMasterArtwork) currentIndex = 3;
  else if (!masterApproved) currentIndex = 5;
  else if (!inProduction) currentIndex = 6;
  else currentIndex = 7;

  return AI_PIPELINE_STEPS.map((step, index) => ({
    ...step,
    status:
      index < currentIndex
        ? "complete"
        : index === currentIndex
          ? "current"
          : "future",
  }));
}

/** Canvas reads only the active workspace iteration — never legacy mission-level fallbacks. */
function getMissionCanvasAssets(mission: DesignMissionState): DesignMissionAssets {
  const workspace = mission.designWorkspaces[mission.brief.designId];
  if (!workspace) return {};
  return getActiveIteration(workspace).assets;
}

const TIMELINE: Array<{ id: CollectionTimelineStage; label: string }> = [
  { id: "research", label: "Research" },
  { id: "design", label: "Design" },
  { id: "images", label: "Images" },
  { id: "marketing", label: "Marketing" },
  { id: "shopify", label: "Shopify" },
  { id: "launch", label: "Launch" },
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
  const canvasAssets = useMemo(
    () => getMissionCanvasAssets(mission),
    [mission],
  );
  const prompts = useMemo(
    () => getEffectivePrompts(brief, iteration.promptOverrides, iteration.assets),
    [brief, iteration.promptOverrides, iteration.assets],
  );

  const [canvasTab, setCanvasTab] = useState<CanvasTab>("concept");
  const [zoom, setZoom] = useState<ZoomLevel>("fit");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [handoffSendDebug, setHandoffSendDebug] = useState<HandoffSaveResult | null>(null);
  const [directionCompareMode, setDirectionCompareMode] = useState(false);
  const [directionCompareOpen, setDirectionCompareOpen] = useState(false);
  const [activeDirectionId, setActiveDirectionId] = useState<string | null>(null);
  const [directionTransitioning, setDirectionTransitioning] = useState(false);
  const [regeneratingDirectionId, setRegeneratingDirectionId] = useState<string | null>(null);
  const [masterRevealToken, setMasterRevealToken] = useState(0);
  const { mockMode } = useStudioMockMode();
  const {
    collapsed: directionPanelCollapsed,
    setCollapsed: setDirectionPanelCollapsed,
  } = usePersistedCollapse("nexhq-ma-direction-panel-collapsed", false);
  const {
    collapsed: inspectorCollapsed,
    setCollapsed: setInspectorCollapsed,
  } = usePersistedCollapse("nexhq-ma-inspector-collapsed", false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setError(null);
  }, []);

  const applyAiDesignerConcept = useCallback(
    (
      concept: import("@/lib/design/ai-designer/types").DesignConcept,
      renderPlan?: import("@/lib/design/ai-designer/types").RenderPlan,
      review?: import("@/lib/design/ai-designer/types").DesignConceptReview,
    ) => {
      onPatchMission((state) => {
        let next = updateMissionAssets(state, {
          aiDesignerConcept: concept,
          aiDesignerRenderPlan: renderPlan,
          aiDesignerReview: review,
          designDirections: undefined,
        });
        next = updatePromptOverride(next, "imagePrompt", concept.imagePrompt.primary);
        next = updatePromptOverride(next, "mockupPrompt", concept.mockupPrompt.primary);
        next = appendVersionEntry(next, "AI Design Concept generated", "design");
        return next;
      });
      setCanvasTab("concept");
      notify(
        mockMode || getMockModeActive()
          ? "AI Design Concept ready (mock) — generate design directions next"
          : "AI Design Concept ready — generate design directions next",
      );
    },
    [mockMode, notify, onPatchMission],
  );

  const handleActiveDirectionChange = useCallback((directionId: string) => {
    setActiveDirectionId((current) => (current === directionId ? current : directionId));
  }, []);

  useEffect(() => {
    console.log("[NexHQ Load] design workspace render");
  }, []);

  useEffect(() => {
    console.log("[NexHQ Load] design workspace ready");
  }, [brief.designId, mission.reportId]);

  useEffect(() => {
    setCanvasTab(resolveCanvasTab(canvasAssets));
  }, [brief.designId, mission.reportId, canvasAssets]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1399px)");
    const apply = () => {
      if (media.matches) {
        setInspectorCollapsed(true);
      }
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [setInspectorCollapsed]);

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

  const runSvgGeneration = useCallback(
    async (options?: { loadingLabel?: string; successMessage?: string }) => {
    const label = options?.loadingLabel ?? "Generate SVG";
    const successMessage = options?.successMessage ?? "Generate SVG complete";
    setActionLoading(label);
    setToast(null);
    setError(null);
    setCanvasTab("concept");
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

      const rawSvgMarkup = extractGeneratedSvg(payload);
      const { svg: svgMarkup } = sanitizePrintArtworkSvg(rawSvgMarkup);
      const svgUrl = svgMarkupToDataUrl(svgMarkup);
      const commercialReview = (
        payload as {
          commercialReview?: {
            approved?: boolean;
            iterations?: number;
            score?: { overall?: number };
            imageStudioBlueprint?: string;
          };
        }
      ).commercialReview;

      onPatchMission((state) => {
        let next = setPipelineStage(state, commercialReview ? "commercial-review" : "design");
        next = setTimelineStage(next, "design");
        next = updateMissionAssets(next, {
          svgUrl,
          svgMarkup,
          commercialApproved: commercialReview?.approved,
          commercialScore: commercialReview?.score?.overall,
          commercialIterations: commercialReview?.iterations,
          imageStudioBlueprint: commercialReview?.imageStudioBlueprint,
          masterArtwork: buildSvgDraftMasterArtwork({
            brief,
            svgMarkup,
            version: `V${iteration.version}`,
            commercialReview,
          }),
        });
        next = appendVersionEntry(
          next,
          options?.loadingLabel === "Generate Master Artwork"
            ? "Master artwork generated"
            : "SVG generated",
          "svg",
        );
        return next;
      });
      setCanvasTab("concept");
      notify(successMessage);
    } catch (err) {
      resetProductionStatus("svg");
      setError(err instanceof Error ? err.message : "Generate SVG failed");
    } finally {
      setActionLoading(null);
    }
  },
    [brief, iteration.version, notify, onPatchMission, resetProductionStatus],
  );

  const runMasterArtworkGeneration = useCallback(async () => {
    const label = "Generate Master Artwork";
    const concept = canvasAssets.aiDesignerConcept;
    if (!concept) {
      setError("Generate an AI Design Concept first — Master Artwork uses the selected design direction.");
      return;
    }

    setActionLoading(label);
    setToast(null);
    setError(null);

    try {
      const selectedDirection = resolveSelectedDirection(canvasAssets.designDirections);
      const directionBrief = selectedDirection
        ? buildDirectionBrief(selectedDirection)
        : undefined;
      const designDirection =
        directionBrief ??
        selectedDirection?.designStory ??
        selectedDirection?.title ??
        concept.creativeDirection.summary;

      if (getMockModeActive()) {
        await mockGenerationDelay(11_200);
        const masterArtwork = buildMockMasterArtworkState({
          brief,
          version: `V${iteration.version}`,
          directionTitle: selectedDirection?.title ?? brief.title,
          directionColors: selectedDirection?.thumbnailColors ?? ["#1a1f2e", "#52c2c2", "#d9b46b"],
          designDirection,
          conceptId: concept.designId,
          printStyle: selectedDirection?.printStyle,
          placement: brief.printArea === "Back" ? "Back print" : "Front chest",
          commercialScore: selectedDirection?.scores.commercial,
        });

        onPatchMission((state) => {
          let next = setPipelineStage(state, "commercial-review");
          next = setTimelineStage(next, "design");
          next = updateMissionAssets(next, {
            commercialApproved: false,
            commercialScore: masterArtwork.commercialScore,
            commercialIterations: 1,
            masterArtwork,
          });
          next = appendVersionEntry(next, "Master artwork generated (mock)", "design");
          return next;
        });
        setCanvasTab("master");
        setMasterRevealToken((token) => token + 1);
        notify("Master artwork generated (mock preview)");
        return;
      }

      const res = await fetch("/api/design/generate-master-artwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          concept,
          selectedConceptId: concept.designId,
          designDirection,
        }),
      });
      const payload = await readGenerationPayload(res);
      if (!res.ok) {
        if (!activateMockModeFromFailure(res.status, payload)) {
          const err =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error ?? "")
              : "";
          throw new Error(err || "Master artwork generation failed");
        }

        await mockGenerationDelay(11_200);
        const masterArtwork = buildMockMasterArtworkState({
          brief,
          version: `V${iteration.version}`,
          directionTitle: selectedDirection?.title ?? brief.title,
          directionColors: selectedDirection?.thumbnailColors ?? ["#1a1f2e", "#52c2c2", "#d9b46b"],
          designDirection,
          conceptId: concept.designId,
          printStyle: selectedDirection?.printStyle,
          placement: brief.printArea === "Back" ? "Back print" : "Front chest",
          commercialScore: selectedDirection?.scores.commercial,
        });

        onPatchMission((state) => {
          let next = setPipelineStage(state, "commercial-review");
          next = setTimelineStage(next, "design");
          next = updateMissionAssets(next, {
            commercialScore: masterArtwork.commercialScore,
            commercialIterations: 1,
            masterArtwork,
          });
          next = appendVersionEntry(next, "Master artwork generated (mock fallback)", "design");
          return next;
        });
        setCanvasTab("master");
        setMasterRevealToken((token) => token + 1);
        notify("Backend offline — mock master artwork loaded");
        return;
      }

      const data = payload as {
        artworkImageUrl?: string;
        transparentPngUrl?: string;
        productionPngUrl?: string;
        previewUrl?: string;
        selectedConceptId?: string;
        designDirection?: string;
        generationMode?: "draft" | "production";
        dpi?: number;
        resolution?: string;
        transparentBackground?: boolean;
        printReady?: boolean;
        commercialReview?: {
          approved?: boolean;
          iterations?: number;
          score?: { overall?: number };
          imageStudioBlueprint?: string;
        };
      };

      const artworkImageUrl = data.artworkImageUrl ?? data.previewUrl;
      if (!artworkImageUrl) {
        throw new Error("Master artwork generation returned no image");
      }

      const commercialReview = data.commercialReview;

      onPatchMission((state) => {
        let next = setPipelineStage(state, commercialReview ? "commercial-review" : "design");
        next = setTimelineStage(next, "design");
        next = updateMissionAssets(next, {
          commercialApproved: commercialReview?.approved,
          commercialScore: commercialReview?.score?.overall,
          commercialIterations: commercialReview?.iterations,
          imageStudioBlueprint: commercialReview?.imageStudioBlueprint,
          masterArtwork: buildAiDesignerMasterArtworkDraft({
            brief,
            version: `V${iteration.version}`,
            artworkImageUrl,
            transparentPngUrl: data.transparentPngUrl ?? artworkImageUrl,
            productionPngUrl: data.productionPngUrl ?? artworkImageUrl,
            previewUrl: data.previewUrl ?? artworkImageUrl,
            selectedConceptId: data.selectedConceptId ?? concept.designId,
            designDirection:
              data.designDirection ??
              selectedDirection?.designStory ??
              selectedDirection?.title ??
              concept.creativeDirection.summary,
            generationMode: data.generationMode ?? "draft",
            dpi: data.dpi ?? 150,
            resolution: data.resolution ?? "1024 × 1024 px",
            transparentBackground: data.transparentBackground ?? true,
            printReady: data.printReady ?? false,
            commercialReview,
          }),
        });
        next = appendVersionEntry(next, "Master artwork generated", "design");
        return next;
      });
      setCanvasTab("master");
      setMasterRevealToken((token) => token + 1);
      notify("Master artwork generated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate Master Artwork failed");
    } finally {
      setActionLoading(null);
    }
  }, [brief, canvasAssets.aiDesignerConcept, canvasAssets.designDirections, iteration.version, notify, onPatchMission]);

  const runDesignDirectionsGeneration = useCallback(async () => {
    const label = "Generate Design Directions";
    const concept = canvasAssets.aiDesignerConcept;
    if (!concept) {
      setError("Generate an AI Design Concept first — directions build on the creative briefing.");
      return;
    }

    setActionLoading(label);
    setToast(null);
    setError(null);

    try {
      const directions = await generateDesignDirections(brief, concept, mission.reportId);
      onPatchMission((state) =>
        updateMissionAssets(state, {
          designDirections: directions,
        }),
      );
      notify(`${directions.length} design directions ready — commercial review complete`);
    } catch (err) {
      if (getMockModeActive()) {
        const directions = generateMockDesignDirections(brief, concept);
        onPatchMission((state) =>
          updateMissionAssets(state, {
            designDirections: directions,
          }),
        );
        notify(`${directions.length} design directions ready (mock fallback)`);
      } else {
        setError(err instanceof Error ? err.message : "Design directions generation failed");
      }
    } finally {
      setActionLoading(null);
    }
  }, [brief, canvasAssets.aiDesignerConcept, mission.reportId, notify, onPatchMission]);

  const selectDirection = useCallback(
    (directionId: string) => {
      const directions = canvasAssets.designDirections;
      if (!directions?.length) return;

      setDirectionCompareMode(false);
      setDirectionCompareOpen(false);
      setDirectionTransitioning(true);

      onPatchMission((state) =>
        updateMissionAssets(state, {
          designDirections: clearDirectionCompare(
            selectDesignDirection(directions, directionId),
          ),
        }),
      );
      notify("Creative direction selected — ready for master artwork");

      window.setTimeout(() => {
        setDirectionTransitioning(false);
      }, 1200);
    },
    [canvasAssets.designDirections, notify, onPatchMission],
  );

  const regenerateDirection = useCallback(
    async (directionId: string) => {
      const concept = canvasAssets.aiDesignerConcept;
      const directions = canvasAssets.designDirections;
      if (!concept || !directions?.length) return;

      setRegeneratingDirectionId(directionId);
      setActionLoading("Regenerate Direction");
      setError(null);

      try {
        const refreshed = await regenerateDesignDirection(
          brief,
          concept,
          directions,
          directionId,
          mission.reportId,
        );
        onPatchMission((state) =>
          updateMissionAssets(state, { designDirections: refreshed }),
        );
        notify("Direction regenerated with fresh team insights");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Direction regeneration failed");
      } finally {
        setRegeneratingDirectionId(null);
        setActionLoading(null);
      }
    },
    [brief, canvasAssets.aiDesignerConcept, canvasAssets.designDirections, mission.reportId, notify, onPatchMission],
  );

  const toggleCompareDirection = useCallback(
    (directionId: string) => {
      const directions = canvasAssets.designDirections;
      if (!directions?.length) return;

      onPatchMission((state) =>
        updateMissionAssets(state, {
          designDirections: toggleDirectionCompare(directions, directionId),
        }),
      );
    },
    [canvasAssets.designDirections, onPatchMission],
  );

  const evolveDirection = useCallback(
    (action: EvolutionAction) => {
      const directions = canvasAssets.designDirections;
      const selected = resolveSelectedDirection(directions);
      if (!directions?.length || !selected) return;

      onPatchMission((state) =>
        updateMissionAssets(state, {
          designDirections: evolveDesignDirection(directions, selected.id, action),
        }),
      );
      notify(`Evolved: ${action.replace(/-/g, " ")}`);
      void runMasterArtworkGeneration();
    },
    [canvasAssets.designDirections, notify, onPatchMission, runMasterArtworkGeneration],
  );

  const blendDirection = useCallback(
    (secondaryId: string) => {
      const directions = canvasAssets.designDirections;
      const selected = resolveSelectedDirection(directions);
      if (!directions?.length || !selected) return;

      onPatchMission((state) =>
        updateMissionAssets(state, {
          designDirections: blendDesignDirections(directions, selected.id, secondaryId),
        }),
      );
      notify("Directions blended — generating hybrid artwork");
      void runMasterArtworkGeneration();
    },
    [canvasAssets.designDirections, notify, onPatchMission, runMasterArtworkGeneration],
  );

  const archiveDirection = useCallback(
    (directionId: string) => {
      const directions = canvasAssets.designDirections;
      if (!directions?.length) return;

      onPatchMission((state) =>
        updateMissionAssets(state, {
          designDirections: archiveDesignDirection(directions, directionId),
        }),
      );
      notify("Direction archived");
    },
    [canvasAssets.designDirections, notify, onPatchMission],
  );

  const duplicateDirection = useCallback(
    (directionId: string) => {
      const directions = canvasAssets.designDirections;
      if (!directions?.length) return;

      onPatchMission((state) =>
        updateMissionAssets(state, {
          designDirections: duplicateDesignDirection(directions, directionId),
        }),
      );
      notify("Direction duplicated");
    },
    [canvasAssets.designDirections, notify, onPatchMission],
  );

  const createVariation = useCallback(() => {
    onPatchMission((state) => createNewIteration(state, brief, "Variation"));
    notify("New variation created");
  }, [brief, notify, onPatchMission]);

  const approveMasterArtwork = useCallback(() => {
    onPatchMission((state) => {
      const workspace = getActiveWorkspace(state);
      const patch = approveMasterArtworkState(workspace.assets, brief);
      if (!patch.masterArtwork) {
        return state;
      }
      let next = updateMissionAssets(state, patch);
      next = appendVersionEntry(next, "Master artwork approved", "approved");
      next = setPipelineStage(next, "approval");
      return next;
    });
    notify("Master artwork approved — ready for Marketing Studio");
  }, [brief, notify, onPatchMission]);

  const runAiDesignerConcept = useCallback(async () => {
    const label = "Generate AI Design Concept";
    setActionLoading(label);
    setToast(null);
    setError(null);

    try {
      if (getMockModeActive()) {
        await mockGenerationDelay(2000);
        const mock = createMockAiDesignerConcept(brief);
        applyAiDesignerConcept(mock.concept, mock.renderPlan, mock.review);
        return;
      }

      const res = await fetch("/api/design/ai-designer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const payload = await readGenerationPayload(res);
      if (!res.ok) {
        if (activateMockModeFromFailure(res.status, payload)) {
          const mock = createMockAiDesignerConcept(brief);
          applyAiDesignerConcept(mock.concept, mock.renderPlan, mock.review);
          return;
        }
        const err =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? "")
            : "";
        throw new Error(err || "AI Designer failed");
      }

      const data = payload as {
        ok?: boolean;
        concept?: import("@/lib/design/ai-designer/types").DesignConcept;
        renderPlan?: import("@/lib/design/ai-designer/types").RenderPlan;
        review?: import("@/lib/design/ai-designer/types").DesignConceptReview;
      };
      if (!data.ok || !data.concept) {
        throw new Error("AI Designer returned no concept");
      }

      applyAiDesignerConcept(data.concept, data.renderPlan, data.review);
    } catch (err) {
      if (getMockModeActive()) {
        const mock = createMockAiDesignerConcept(brief);
        applyAiDesignerConcept(mock.concept, mock.renderPlan, mock.review);
      } else {
        setError(err instanceof Error ? err.message : "AI Designer failed");
      }
    } finally {
      setActionLoading(null);
    }
  }, [applyAiDesignerConcept, brief]);

  const masterArtworkView = useMemo(
    () => resolveMasterArtworkView(canvasAssets, iteration.label),
    [canvasAssets, iteration.label],
  );

  const refineDirection = useCallback(() => {
    const directions = canvasAssets.designDirections;
    if (!directions?.length) return;

    onPatchMission((state) =>
      updateMissionAssets(state, {
        designDirections: directions.map((direction) => ({
          ...direction,
          selected: false,
        })),
      }),
    );
    notify("Return to Design Directions to refine your selection");
  }, [canvasAssets.designDirections, notify, onPatchMission]);

  const createMasterVersion = useCallback(
    (targetVersion: 2 | 3) => {
      const currentMax = Math.max(...workspace.iterations.map((i) => i.version), 1);
      const iterationsNeeded = Math.max(0, targetVersion - currentMax);

      onPatchMission((state) => {
        let next = state;
        for (let step = 0; step < iterationsNeeded; step += 1) {
          next = createNewIteration(next, brief, `Version ${currentMax + step + 1}`);
        }
        if (iterationsNeeded === 0) {
          next = createNewIteration(next, brief, `Version ${currentMax + 1}`);
        }
        return next;
      });
      notify(`Version ${targetVersion} workspace ready`);
    },
    [brief, notify, onPatchMission, workspace.iterations],
  );

  const sendToMarketingStudio = useCallback(() => {
    if (!masterArtworkView.isApproved) {
      setError("Approve Master Artwork before sending to Marketing Studio.");
      setToast(null);
      return;
    }
    router.push("/agents/marketing");
  }, [masterArtworkView.isApproved, router]);

  const sendToImageStudio = useCallback(() => {
    if (!masterArtworkView.isApproved) {
      setError("Approve Master Artwork before production.");
      setToast(null);
      return;
    }
    const saveResult = sendDesignHandoffToImageStudio({
      title: brief.title,
      collection: mission.collectionName ?? "",
      garment: brief.product,
      colorway: brief.color,
      version: `V${iteration.version}`,
      imagePrompt: prompts.imagePrompt,
      mockupPrompt: prompts.mockupPrompt,
      designId: brief.designId,
      reportId: mission.reportId,
      assets: canvasAssets,
      aiDesignerConcept: canvasAssets.aiDesignerConcept,
      renderPlan: canvasAssets.aiDesignerRenderPlan,
      review: canvasAssets.aiDesignerReview,
    });
    setHandoffSendDebug(saveResult);
    if (!saveResult.saved) {
      setError(saveResult.error ?? "Failed to save Image Studio handoff");
      return;
    }
    console.info("[Design Studio] navigating to Image Studio");
    router.push("/agents/image");
  }, [
    brief,
    mission.collectionName,
    mission.reportId,
    prompts.imagePrompt,
    prompts.mockupPrompt,
    iteration.version,
    router,
    canvasAssets,
    masterArtworkView.isApproved,
  ]);

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
      setCanvasTab(canvasTabForAssetKey(assetKey));
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
        const isMockup = assetKey === "mockupUrl";
        const isRender = assetKey === "renderUrl";
        const requestBody = isMockup
          ? buildDesignMockupPayload({
              brief,
              collectionName: mission.collectionName,
              assets: canvasAssets,
              mockupPrompt: prompt,
            })
          : isRender
            ? buildDesignRenderPayload({
                brief,
                collectionName: mission.collectionName,
                assets: canvasAssets,
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
          let next = setPipelineStage(state, pipeline);
          next = setTimelineStage(next, timeline);
          if (imageUrl) next = updateMissionAssets(next, { [assetKey]: imageUrl });
          next = appendVersionEntry(next, versionLabel, versionType);
          return next;
        });
        if (imageUrl) {
          setCanvasTab(canvasTabForAssetKey(assetKey));
        }
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
    [brief, canvasAssets, mission.collectionName, notify, onPatchMission, resetProductionStatus],
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
        const payload = await readGenerationPayload(res);
        if (!res.ok) {
          const err =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error ?? "")
              : "";
          throw new Error(err || "Director unavailable");
        }

        const data = payload as {
          ok?: boolean;
          error?: string;
          response?: string;
          briefPatch?: Partial<DesignStudioBrief>;
          promptPatch?: Partial<DesignPromptOverrides>;
        };
        if (!data.ok) throw new Error(data.error ?? "Director unavailable");

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

  const selectedDirection = resolveSelectedDirection(canvasAssets.designDirections);
  const hasDirections = Boolean(canvasAssets.designDirections?.length);
  const workflowStep = deriveWorkflowStep(
    Boolean(canvasAssets.aiDesignerConcept),
    hasDirections,
    Boolean(selectedDirection),
    masterArtworkView.hasArtwork,
    masterArtworkView.isApproved,
  );
  const canGenerateMaster =
    Boolean(canvasAssets.aiDesignerConcept) &&
    (!hasDirections || Boolean(selectedDirection));

  const compareDirections = resolveCompareDirections(canvasAssets.designDirections);
  const showDirectionsStage =
    Boolean(canvasAssets.aiDesignerConcept) &&
    (!selectedDirection || directionCompareMode || !hasDirections);
  const showMasterCanvas = !showDirectionsStage;
  const isMasterFocusMode =
    showMasterCanvas && Boolean(selectedDirection) && directionPanelCollapsed && inspectorCollapsed;

  const advancedTools = (
    <>
      <div className="cs-advanced-actions">
        <button type="button" className="cs-btn cs-btn-compact" disabled={Boolean(actionLoading)} onClick={() => void runSvgGeneration()}>
          SVG Draft
        </button>
        <button
          type="button"
          className="cs-btn cs-btn-compact"
          disabled={Boolean(actionLoading)}
          onClick={() =>
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
        >
          AI Render
        </button>
        <button
          type="button"
          className="cs-btn cs-btn-compact"
          disabled={Boolean(actionLoading)}
          onClick={() =>
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
        >
          Mockup
        </button>
        <button
          type="button"
          className="cs-btn cs-btn-compact"
          onClick={() => {
            if (canvasAssets.svgUrl) {
              const a = document.createElement("a");
              a.href = canvasAssets.svgUrl;
              a.download = `${brief.designId}.svg`;
              a.click();
            } else {
              void navigator.clipboard.writeText(prompts.svgPrompt);
              notify("SVG prompt copied");
            }
          }}
        >
          Export SVG
        </button>
        <button type="button" className="cs-btn cs-btn-compact" onClick={() => onSaveDraft?.()}>
          Save Draft
        </button>
      </div>
      <div className={cn("cw-studio-stage cw-studio-stage--advanced")}>
        <div className="cw-workspace-core">
          <DesignCanvas
            tab={canvasTab}
            onTabChange={setCanvasTab}
            zoom={zoom}
            onZoomChange={setZoom}
            assets={canvasAssets}
            title={brief.title}
            garmentType={resolveGarmentType(brief.product)}
            onGenerateConcept={() => void runAiDesignerConcept()}
            onGenerateMasterArtwork={() => void runMasterArtworkGeneration()}
            actionLoading={actionLoading}
          />
        </div>
      </div>
    </>
  );

  const isMasterArtworkMode = showMasterCanvas && Boolean(selectedDirection);

  return (
    <div className={cn("cw-root cw-studio-app", isMasterArtworkMode && "is-master-artwork-mode")}>
      <MockModeBadge active={mockMode} className="cw-mock-badge-floating" />
      <div className="cw-main">
        <StudioChrome
          title={brief.title}
          collectionName={mission.collectionName}
          activeStep={workflowStep}
          loading={actionLoading}
          hasConcept={Boolean(canvasAssets.aiDesignerConcept)}
          designs={mission.allBriefs ?? [brief]}
          activeDesignId={brief.designId}
          onSelectDesign={onSelectBrief}
          onGenerateConcept={() => void runAiDesignerConcept()}
        />

        <div
          className={cn(
            "cs-workspace",
            directionTransitioning && "is-transitioning",
            showMasterCanvas && selectedDirection && "is-master-artwork",
            directionPanelCollapsed && "is-direction-collapsed",
            inspectorCollapsed && "is-inspector-collapsed",
            isMasterFocusMode && "is-focus-mode",
          )}
        >
          {showMasterCanvas && selectedDirection ? (
            <MasterArtworkLeftRail
              direction={selectedDirection}
              iterations={workspace.iterations}
              activeIterationId={workspace.activeIterationId}
              collapsed={directionPanelCollapsed}
              onCollapsedChange={setDirectionPanelCollapsed}
              onSelectVersion={(id) => onPatchMission((s) => restoreIteration(s, id))}
              revealToken={masterRevealToken}
            />
          ) : (
            <CreativeDirectionsSidebar
              directions={canvasAssets.designDirections}
              iterations={workspace.iterations}
              activeIterationId={workspace.activeIterationId}
              activeDirectionId={activeDirectionId}
              loading={actionLoading === "Generate Design Directions"}
              hasConcept={Boolean(canvasAssets.aiDesignerConcept)}
              onGenerateDirections={() => void runDesignDirectionsGeneration()}
              onNavigateDirection={handleActiveDirectionChange}
              onSelectDirection={selectDirection}
              onArchiveDirection={archiveDirection}
              onDuplicateDirection={duplicateDirection}
              onSelectVersion={(id) => onPatchMission((s) => restoreIteration(s, id))}
            />
          )}

          <div
            className={cn(
              "cs-workspace-center",
              showMasterCanvas && selectedDirection && "cs-nexhq-scroll is-master-scroll",
            )}
          >
          {showDirectionsStage ? (
            <CreativeDirectionsStage
              directions={canvasAssets.designDirections}
              loading={
                actionLoading === "Generate Design Directions" ||
                Boolean(regeneratingDirectionId)
              }
              hasConcept={Boolean(canvasAssets.aiDesignerConcept)}
              compareMode={directionCompareMode}
              activeDirectionId={activeDirectionId}
              onActiveDirectionChange={handleActiveDirectionChange}
              onGenerate={() => void runDesignDirectionsGeneration()}
              onSelect={selectDirection}
              onRegenerate={(id) => void regenerateDirection(id)}
              onDuplicate={duplicateDirection}
              onToggleCompare={toggleCompareDirection}
              onOpenCompare={() => setDirectionCompareOpen(true)}
              onToggleCompareMode={() => {
                setDirectionCompareMode((prev) => {
                  if (prev) {
                    onPatchMission((state) => {
                      const dirs = getMissionCanvasAssets(state).designDirections;
                      if (!dirs?.length) return state;
                      return updateMissionAssets(state, {
                        designDirections: clearDirectionCompare(dirs),
                      });
                    });
                    setDirectionCompareOpen(false);
                  }
                  return !prev;
                });
              }}
            />
          ) : showMasterCanvas && selectedDirection ? (
            <MasterArtworkStage
              brief={brief}
              assets={canvasAssets}
              versionLabel={iteration.label}
              loading={actionLoading}
              canGenerate={canGenerateMaster}
              selectedDirection={selectedDirection}
              isTransitioning={directionTransitioning}
              focusMode={isMasterFocusMode}
              revealToken={masterRevealToken}
              onGenerate={() => void runMasterArtworkGeneration()}
              onRegenerate={() => void runMasterArtworkGeneration()}
              onApprove={approveMasterArtwork}
              onRefineDirection={refineDirection}
              onCreateVersion={createMasterVersion}
              onSendToMarketing={sendToMarketingStudio}
            />
          ) : showMasterCanvas ? (
            <MasterArtworkCanvas
              brief={brief}
              assets={canvasAssets}
              versionLabel={iteration.label}
              loading={actionLoading}
              hasConcept={Boolean(canvasAssets.aiDesignerConcept)}
              canGenerate={canGenerateMaster}
              selectedDirection={selectedDirection}
              otherDirections={canvasAssets.designDirections ?? []}
              isTransitioning={directionTransitioning}
              chatLoading={chatLoading}
              onGenerate={() => void runMasterArtworkGeneration()}
              onRegenerate={() => void runMasterArtworkGeneration()}
              onVariation={createVariation}
              onApprove={approveMasterArtwork}
              onSendToImageStudio={sendToImageStudio}
              onEvolve={evolveDirection}
              onRevision={sendDirectorMessage}
            />
          ) : (
            <MasterArtworkCanvas
              brief={brief}
              assets={canvasAssets}
              versionLabel={iteration.label}
              loading={actionLoading}
              hasConcept={Boolean(canvasAssets.aiDesignerConcept)}
              canGenerate={canGenerateMaster}
              selectedDirection={selectedDirection}
              chatLoading={chatLoading}
              onGenerate={() => void runMasterArtworkGeneration()}
              onRegenerate={() => void runMasterArtworkGeneration()}
              onVariation={createVariation}
              onApprove={approveMasterArtwork}
              onSendToImageStudio={sendToImageStudio}
              onRevision={sendDirectorMessage}
            />
          )}

          </div>

          {showMasterCanvas && selectedDirection ? (
            <MasterArtworkInspector
              brief={brief}
              concept={canvasAssets.aiDesignerConcept}
              direction={selectedDirection}
              health={workspace.health}
              view={masterArtworkView}
              collapsed={inspectorCollapsed}
              onCollapsedChange={setInspectorCollapsed}
              revealToken={masterRevealToken}
            />
          ) : (
            <StudioInspector
              brief={brief}
              concept={canvasAssets.aiDesignerConcept}
              review={canvasAssets.aiDesignerReview}
              renderPlan={canvasAssets.aiDesignerRenderPlan}
              assets={canvasAssets}
              health={workspace.health}
              masterArtworkView={masterArtworkView}
              commercialScore={brief.commercialScore ?? canvasAssets.commercialScore}
              collectionName={mission.collectionName}
              versionHistory={mission.versionHistory}
              activeIteration={iteration}
              selectedDirection={selectedDirection}
              advancedTools={advancedTools}
            />
          )}
        </div>

        <div className="cs-toast-stack">
          {toast ? <p className="cw-toast">{toast}</p> : null}
          {error ? <p className="cw-error">{error}</p> : null}
        </div>
      </div>

      {renderCommerceSection ? (
        <div className="cw-commerce-span" hidden>
          <DesignLabCollapse title="Commerce Intelligence" meta="Hidden" defaultOpen={false}>
            {renderCommerceSection()}
          </DesignLabCollapse>
        </div>
      ) : null}

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

      {directionCompareOpen && compareDirections.length >= 2 ? (
        <DirectionCompareModal
          directions={compareDirections}
          onClose={() => setDirectionCompareOpen(false)}
          onSelectWinner={(id) => {
            setDirectionCompareOpen(false);
            selectDirection(id);
          }}
        />
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

export function CreativeWorkspaceEmpty({
  onStartDemo,
  mockMode,
}: {
  onStartDemo?: () => void;
  mockMode?: boolean;
}) {
  return (
    <section className="cw-empty">
      <div className="cw-empty-canvas cw-canvas-studio-empty">
        <div className="cw-canvas-luxury-bg" aria-hidden />
        <div className="cw-canvas-texture" aria-hidden />
        <PremiumGarmentCanvas garmentType="tee" empty />
        <div className="cw-canvas-glass-overlay" aria-hidden />
        <div className="cw-canvas-studio-card">
          <h2 className="cw-canvas-studio-card-title">Enter the AI Fashion Creative Lab.</h2>
          <p className="cw-canvas-studio-card-caption">
            Research flows into Creative Director, AI Designer, design directions, and a single approved Master Artwork.
          </p>
          <p className="cw-canvas-studio-card-sub">
            {mockMode
              ? "Backend is offline — start the demo flow to explore the full Design Studio locally."
              : "Open a collection brief from Reports Center — Image Studio handles production only."}
          </p>
          <div className="cw-empty-actions">
            {onStartDemo ? (
              <button type="button" className="cw-toolbar-btn cw-btn-primary" onClick={onStartDemo}>
                Start Demo Flow
              </button>
            ) : null}
            <Link href="/facility/reports" className="cw-toolbar-btn">
              Browse Reports
            </Link>
          </div>
        </div>
      </div>
      <div>
        <p className="cw-eyebrow">AI Fashion Creative Director</p>
        <h1>Design Studio</h1>
        <p className="cw-empty-copy">
          An AI fashion design studio — creative directions, commercial review, and approved master artwork for production.
        </p>
      </div>
    </section>
  );
}

function formatMissionDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function MissionHeader({
  missionName,
  collectionName,
  narrative,
  dnaScore,
  printReadyScore,
  commercialScore,
  commercialStatus,
  versionLabel,
  lastUpdated,
}: {
  missionName: string;
  collectionName?: string;
  narrative?: string;
  dnaScore?: number;
  printReadyScore: number;
  commercialScore?: number;
  commercialStatus: string;
  versionLabel: string;
  lastUpdated?: string;
}) {
  const narrativeText = narrative?.trim();

  return (
    <header className="cw-mission-header" aria-label="Design mission">
      <div className="cw-mission-header-primary">
        <h1 className="cw-mission-header-title">{missionName}</h1>
        {narrativeText ? (
          <p className="cw-mission-header-narrative">{narrativeText}</p>
        ) : null}
      </div>
      <div className="cw-mission-header-metrics">
        <MissionMetric label="Commercial Status" value={commercialStatus} highlight />
        {dnaScore !== undefined ? (
          <MissionMetric label="DNA" value={`${dnaScore}%`} />
        ) : null}
        <MissionMetric label="Print Ready" value={`${printReadyScore}%`} />
        {commercialScore !== undefined ? (
          <MissionMetric label="Commercial Score" value={`${commercialScore}%`} />
        ) : null}
        <MissionMetric label="Version" value={versionLabel} />
        <MissionMetric label="Updated" value={formatMissionDate(lastUpdated)} />
        {collectionName ? (
          <MissionMetric label="Collection" value={collectionName} />
        ) : null}
      </div>
    </header>
  );
}

function MissionMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("cw-mission-metric", highlight && "is-highlight")}>
      <span className="cw-mission-metric-label">{label}</span>
      <span className="cw-mission-metric-value">{value}</span>
    </div>
  );
}

function AiPipelinePreview({
  steps,
}: {
  steps: Array<{ id: string; label: string; status: PipelineStepStatus }>;
}) {
  return (
    <nav className="cw-ai-pipeline cw-ai-pipeline-timeline" aria-label="AI creative pipeline">
      <ol className="cw-ai-pipeline-track">
        {steps.map((step, index) => (
          <li key={step.id} className="cw-ai-pipeline-segment">
            <span className={cn("cw-ai-pipeline-node", `is-${step.status}`)}>
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span className="cw-ai-pipeline-connector" aria-hidden>
                ↓
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
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
  garmentType,
  onGenerateConcept,
  onGenerateMasterArtwork,
  actionLoading,
}: {
  tab: CanvasTab;
  onTabChange: (t: CanvasTab) => void;
  zoom: ZoomLevel;
  onZoomChange: (z: ZoomLevel) => void;
  assets: PerDesignWorkspace["assets"];
  title: string;
  garmentType: GarmentType;
  onGenerateConcept?: () => void;
  onGenerateMasterArtwork?: () => void;
  actionLoading?: string | null;
}) {
  const concept = assets.aiDesignerConcept;
  const masterArtworkUrl = resolveMasterArtworkPreviewUrl(assets);
  const assetCount = countCanvasAssets(assets);
  const tabs: Array<{ id: CanvasTab; label: string; available: boolean }> = [
    { id: "concept", label: "Concept", available: true },
    { id: "master", label: "Master Artwork", available: true },
    { id: "mockup", label: "Mockup Preview", available: true },
    {
      id: "compare",
      label: "Compare",
      available: assetCount >= 2 && Boolean(masterArtworkUrl && assets.mockupUrl),
    },
  ];

  const zoomOptions: ZoomLevel[] = [0.25, 0.5, 0.75, 1, 1.5, "fit"];
  const anyAsset = hasCanvasAsset(assets);
  const scale = zoom === "fit" ? 1 : zoom;

  const renderMasterLayer = () => {
    if (isCanvasLayerGenerating("master", actionLoading ?? null)) {
      return <CanvasLayerGenerating layer="master" garmentType={garmentType} />;
    }

    if (!masterArtworkUrl) {
      return (
        <CanvasStudioEmpty
          variant="master"
          garmentType={garmentType}
          hasConcept={Boolean(concept)}
          onGenerateConcept={onGenerateConcept}
          onGenerateMasterArtwork={onGenerateMasterArtwork}
          loading={actionLoading ?? null}
        />
      );
    }

    return (
      <div className="cw-canvas-product-shot cw-canvas-master-shot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={masterArtworkUrl}
          src={masterArtworkUrl}
          alt={`${title} master artwork`}
          className="cw-canvas-product-img cw-canvas-master-img"
        />
      </div>
    );
  };

  const renderMockupLayer = () => {
    if (isCanvasLayerGenerating("mockup", actionLoading ?? null)) {
      return <CanvasLayerGenerating layer="mockup" garmentType={garmentType} />;
    }

    if (!assets.mockupUrl) {
      return (
        <CanvasStudioEmpty
          variant="mockup"
          garmentType={garmentType}
          hasConcept={Boolean(concept)}
          loading={actionLoading ?? null}
        />
      );
    }

    return (
      <div className="cw-canvas-product-shot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={assets.mockupUrl}
          src={assets.mockupUrl}
          alt={`${title} mockup`}
          className="cw-canvas-product-img"
        />
      </div>
    );
  };

  const renderConceptLayer = () => {
    if (isCanvasLayerGenerating("master", actionLoading ?? null)) {
      return <CanvasLayerGenerating layer="concept" garmentType={garmentType} />;
    }

    if (!concept) {
      return (
        <CanvasStudioEmpty
          variant="concept"
          garmentType={garmentType}
          onGenerateConcept={onGenerateConcept}
          onGenerateMasterArtwork={onGenerateMasterArtwork}
          loading={actionLoading ?? null}
        />
      );
    }

    return (
      <div className="cw-canvas-concept-card">
        <p className="cw-canvas-concept-kicker">AI Design Concept</p>
        <h3 className="cw-canvas-concept-title">{concept.title}</h3>
        <p className="cw-canvas-concept-summary">{concept.creativeDirection.summary}</p>
        <p className="cw-canvas-concept-story">{concept.designStory}</p>
        <div className="cw-canvas-concept-meta">
          <span>{concept.product}</span>
          <span>{concept.color}</span>
          <span>{concept.printArea}</span>
        </div>
      </div>
    );
  };

  return (
    <section className="cw-canvas-section">
      <div className="cw-canvas-toolbar">
        <div className="cw-canvas-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                "cw-canvas-tab",
                tab === t.id && "active",
                !t.available && "is-unavailable",
              )}
              disabled={!t.available}
              onClick={() => {
                if (!t.available) return;
                onTabChange(t.id);
              }}
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
      <div className={cn("cw-canvas-stage", anyAsset ? "has-assets" : "is-studio-empty")}>
        <div className="cw-canvas-luxury-bg" aria-hidden />
        <div className="cw-canvas-texture" aria-hidden />
        <div className="cw-canvas-ambient" aria-hidden />
        <div className="cw-canvas-spotlight" aria-hidden />
        <div className="cw-canvas-vignette" aria-hidden />
        <div className="cw-canvas-depth" aria-hidden />
        {!anyAsset ? <div className="cw-canvas-glass-overlay" aria-hidden /> : null}
        <div
          className="cw-canvas-viewport"
          style={{
            transform: zoom === "fit" ? undefined : `scale(${scale})`,
          }}
        >
          {tab === "compare" ? (
            <div className="cw-canvas-split">
              <div>{renderMasterLayer()}</div>
              <div>{renderMockupLayer()}</div>
            </div>
          ) : tab === "concept" ? (
            renderConceptLayer()
          ) : tab === "master" ? (
            renderMasterLayer()
          ) : (
            renderMockupLayer()
          )}
        </div>
      </div>
    </section>
  );
}

function CanvasLayerGenerating({
  layer,
  garmentType,
}: {
  layer: "concept" | "master" | "mockup";
  garmentType: GarmentType;
}) {
  const layerLabel =
    layer === "concept"
      ? "AI design concept"
      : layer === "master"
        ? "master artwork"
        : "mockup preview";

  return (
    <div className="cw-canvas-layer-generating" aria-live="polite" aria-busy="true">
      <PremiumGarmentCanvas garmentType={garmentType} empty subtle />
      <div className="cw-canvas-layer-generating-card">
        <Loader2 className="cw-canvas-layer-generating-icon animate-spin" aria-hidden />
        <p className="cw-canvas-layer-generating-title">Generating {layerLabel}…</p>
        <p className="cw-canvas-layer-generating-copy">Crafting premium apparel design</p>
      </div>
    </div>
  );
}

function CanvasStudioEmpty({
  variant,
  garmentType,
  hasConcept,
  onGenerateConcept,
  onGenerateMasterArtwork,
  loading,
}: {
  variant: "concept" | "master" | "mockup";
  garmentType: GarmentType;
  hasConcept?: boolean;
  onGenerateConcept?: () => void;
  onGenerateMasterArtwork?: () => void;
  loading: string | null;
}) {
  if (variant === "concept") {
    return (
      <div className="cw-canvas-studio-empty">
        <PremiumGarmentCanvas garmentType={garmentType} empty />
        <div className="cw-canvas-studio-card">
          <h3 className="cw-canvas-studio-card-title">Create your next premium apparel design.</h3>
          <p className="cw-canvas-studio-card-caption">
            Start with an AI Design Concept, then generate a print-ready Master Artwork.
          </p>
          <div className="cw-canvas-studio-empty-actions">
            <button
              type="button"
              className="cw-toolbar-btn cw-btn-primary"
              disabled={loading === "Generate AI Design Concept"}
              onClick={onGenerateConcept}
            >
              {loading === "Generate AI Design Concept" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>Generate AI Design Concept</span>
            </button>
            <button
              type="button"
              className="cw-toolbar-btn cw-btn-secondary"
              disabled={loading === "Generate Master Artwork"}
              onClick={onGenerateMasterArtwork}
            >
              {loading === "Generate Master Artwork" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>Generate Master Artwork</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "master") {
    return (
      <div className="cw-canvas-layer-empty">
        <PremiumGarmentCanvas garmentType={garmentType} empty subtle />
        <p className="cw-canvas-layer-empty-copy">
          {hasConcept
            ? "No master artwork yet. Generate print-ready apparel artwork from your AI Design Concept."
            : "Generate an AI Design Concept first, then create Master Artwork."}
        </p>
        {hasConcept ? (
          <button
            type="button"
            className="cw-toolbar-btn cw-btn-primary"
            disabled={loading === "Generate Master Artwork"}
            onClick={onGenerateMasterArtwork}
          >
            {loading === "Generate Master Artwork" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>Generate Master Artwork</span>
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="cw-canvas-layer-empty">
      <PremiumGarmentCanvas garmentType={garmentType} empty subtle />
      <p className="cw-canvas-layer-empty-copy">
        No mockup preview yet. Use Advanced → Generate Mockup after master artwork is approved.
      </p>
    </div>
  );
}

function ToolbarDropdown({
  label,
  icon: Icon,
  items,
  loading,
}: {
  label: string;
  icon: typeof Shapes;
  items: Array<{
    label: string;
    actionKey: string;
    icon: typeof Shapes;
    action: () => void;
    variant?: "primary" | "secondary" | "success";
  }>;
  loading: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const isGroupLoading = items.some((item) => loading === item.actionKey);

  return (
    <div className={cn("cw-toolbar-dropdown", open && "is-open")} ref={ref}>
      <button
        type="button"
        className="cw-toolbar-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {isGroupLoading && !open ? (
          <Loader2 className="cw-toolbar-pro-icon animate-spin" />
        ) : (
          <Icon className="cw-toolbar-pro-icon" />
        )}
        <span className="cw-toolbar-pro-label">{label}</span>
        <ChevronDown className={cn("cw-toolbar-dropdown-chevron", open && "is-open")} />
      </button>
      {open ? (
        <div className="cw-toolbar-dropdown-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.actionKey}
              type="button"
              role="menuitem"
              className={cn(
                "cw-toolbar-dropdown-item",
                item.variant && `cw-btn-${item.variant}`,
              )}
              disabled={loading === item.actionKey}
              onClick={() => {
                setOpen(false);
                item.action();
              }}
            >
              {loading === item.actionKey ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <item.icon className="size-3.5" />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductionToolbar({
  loading,
  hasAiConcept,
  hasDesignDirections,
  hasSelectedDirection,
  hasMasterArtwork,
  masterArtworkApproved,
  onGenerateAiConcept,
  onGenerateDesignDirections,
  onGenerateMasterArtwork,
  onApproveArtwork,
  onSendImageStudio,
  onGenerateSvg,
  onGenerateMockup,
  onGenerateRender,
  onExportSvg,
  onExportPng,
  onSaveDraft,
}: {
  loading: string | null;
  hasAiConcept: boolean;
  hasDesignDirections: boolean;
  hasSelectedDirection: boolean;
  hasMasterArtwork: boolean;
  masterArtworkApproved: boolean;
  onGenerateAiConcept: () => void;
  onGenerateDesignDirections: () => void;
  onGenerateMasterArtwork: () => void;
  onApproveArtwork: () => void;
  onSendImageStudio: () => void;
  onGenerateSvg: () => void;
  onGenerateMockup: () => void;
  onGenerateRender: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onSaveDraft: () => void;
}) {
  const advancedItems = [
    {
      label: "SVG Draft",
      actionKey: "Generate SVG",
      icon: Shapes,
      action: onGenerateSvg,
    },
    {
      label: "Generate Mockup",
      actionKey: "Generate Mockup",
      icon: ImageIcon,
      action: onGenerateMockup,
    },
    {
      label: "Generate AI Render",
      actionKey: "Generate AI Render",
      icon: Wand2,
      action: onGenerateRender,
    },
  ];

  const exportItems = [
    { label: "PNG", actionKey: "Export PNG", icon: Download, action: onExportPng },
    { label: "SVG Draft", actionKey: "Export SVG", icon: Download, action: onExportSvg },
  ];

  const productionItems = [
    {
      label: "Save Draft",
      actionKey: "Save Draft",
      icon: Save,
      action: onSaveDraft,
      variant: "success" as const,
    },
    { label: "Upscale", actionKey: "Upscale", icon: ZoomIn, action: () => {} },
    {
      label: "Remove Background",
      actionKey: "Remove Background",
      icon: Maximize2,
      action: () => {},
    },
  ];

  return (
    <div className="cw-toolbar cw-toolbar-menus cw-toolbar-unified cw-toolbar-pro cw-workflow-toolbar">
      <button
        type="button"
        className="cw-toolbar-pro-action cw-workflow-primary"
        disabled={loading === "Generate AI Design Concept"}
        onClick={onGenerateAiConcept}
      >
        {loading === "Generate AI Design Concept" ? (
          <Loader2 className="cw-toolbar-pro-icon animate-spin" />
        ) : (
          <Sparkles className="cw-toolbar-pro-icon" />
        )}
        <span className="cw-toolbar-pro-label">Generate AI Design Concept</span>
      </button>
      <button
        type="button"
        className="cw-toolbar-pro-action cw-workflow-primary"
        disabled={loading === "Generate Design Directions" || !hasAiConcept}
        onClick={onGenerateDesignDirections}
      >
        {loading === "Generate Design Directions" ? (
          <Loader2 className="cw-toolbar-pro-icon animate-spin" />
        ) : (
          <Sparkles className="cw-toolbar-pro-icon" />
        )}
        <span className="cw-toolbar-pro-label">Generate Design Directions</span>
      </button>
      <button
        type="button"
        className="cw-toolbar-pro-action cw-workflow-primary"
        disabled={
          loading === "Generate Master Artwork" ||
          !hasAiConcept ||
          (hasDesignDirections && !hasSelectedDirection)
        }
        title={
          hasDesignDirections && !hasSelectedDirection
            ? "Select a design direction first"
            : undefined
        }
        onClick={onGenerateMasterArtwork}
      >
        {loading === "Generate Master Artwork" ? (
          <Loader2 className="cw-toolbar-pro-icon animate-spin" />
        ) : (
          <Sparkles className="cw-toolbar-pro-icon" />
        )}
        <span className="cw-toolbar-pro-label">Generate Master Artwork</span>
      </button>
      <button
        type="button"
        className="cw-toolbar-pro-action"
        disabled={loading != null || !hasMasterArtwork || masterArtworkApproved}
        onClick={onApproveArtwork}
      >
        <Stamp className="cw-toolbar-pro-icon" />
        <span className="cw-toolbar-pro-label">Approve Artwork</span>
      </button>
      <button
        type="button"
        className="cw-toolbar-pro-action cw-workflow-handoff"
        disabled={loading != null || !masterArtworkApproved}
        title={
          masterArtworkApproved
            ? "Send approved master artwork to Image Studio"
            : "Approve Master Artwork before production"
        }
        onClick={onSendImageStudio}
      >
        <Send className="cw-toolbar-pro-icon" />
        <span className="cw-toolbar-pro-label">Send to Image Studio</span>
      </button>
      <ToolbarDropdown
        label="Advanced"
        icon={Wand2}
        items={advancedItems}
        loading={loading}
      />
      <ToolbarDropdown
        label="Export"
        icon={Download}
        items={exportItems}
        loading={loading}
      />
      <ToolbarDropdown
        label="Production"
        icon={Save}
        items={productionItems}
        loading={loading}
      />
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
  const size = 36;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const center = size / 2;
  return (
    <div className="cw-radial" title={`${label}: ${value}`}>
      <div className="cw-radial-ring">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="cw-radial-svg cw-radial-animated"
          aria-hidden
        >
          <circle
            cx={center}
            cy={center}
            r={r}
            className="cw-radial-track"
            strokeWidth={stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={r}
            className="cw-radial-fill"
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="cw-radial-value">{value}</span>
      </div>
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

function QuickApprovalPanel({
  masterArtworkApproved,
  onApprove,
  onRevision,
  onArchive,
  onBackResearch,
  onImageStudio,
  onCeo,
}: {
  masterArtworkApproved: boolean;
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
      <button
        type="button"
        className="cw-approval-btn cw-btn-secondary"
        onClick={onImageStudio}
        disabled={!masterArtworkApproved}
        title={
          masterArtworkApproved
            ? "Send approved master artwork to Image Studio"
            : "Approve Master Artwork before production"
        }
      >
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

function PremiumGarmentCanvas({
  garmentType,
  artworkUrl,
  title,
  empty = false,
  subtle = false,
}: {
  garmentType: GarmentType;
  artworkUrl?: string;
  title?: string;
  empty?: boolean;
  subtle?: boolean;
}) {
  const uid = useId().replace(/:/g, "");

  return (
    <div
      className={cn(
        "cw-garment-premium-stage",
        empty && "is-empty",
        subtle && "is-subtle",
        garmentType === "hoodie" && "is-hoodie",
      )}
      aria-hidden={empty && !artworkUrl ? true : undefined}
    >
      <div className="cw-garment-floor-shadow" aria-hidden />
      {garmentType === "hoodie" ? (
        <svg viewBox="0 0 400 520" className="cw-garment-premium-svg" aria-hidden>
          <defs>
            <linearGradient id={`${uid}-fabric`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e2430" />
              <stop offset="45%" stopColor="#141820" />
              <stop offset="100%" stopColor="#0e1118" />
            </linearGradient>
            <linearGradient id={`${uid}-highlight`} x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.09" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
            </linearGradient>
            <radialGradient id={`${uid}-glow`} cx="50%" cy="35%" r="55%">
              <stop offset="0%" stopColor="#52c2c2" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#52c2c2" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="200" cy="260" rx="130" ry="160" fill={`url(#${uid}-glow)`} />
          <path
            d="M68 118 Q200 58 332 118 L358 168 L332 468 L68 468 L42 168 Z"
            fill={`url(#${uid}-fabric)`}
            stroke="rgb(255 255 255 / 0.08)"
            strokeWidth="1.2"
          />
          <path
            d="M68 118 Q200 58 332 118 L358 168 L332 468 L68 468 L42 168 Z"
            fill={`url(#${uid}-highlight)`}
          />
          <path
            d="M118 118 Q200 88 282 118 L298 148 L282 198 L118 198 L102 148 Z"
            fill="rgb(0 0 0 / 0.28)"
            stroke="rgb(255 255 255 / 0.06)"
            strokeWidth="0.8"
          />
          <path
            d="M128 118 Q200 96 272 118"
            fill="none"
            stroke="rgb(255 255 255 / 0.1)"
            strokeWidth="1"
          />
          <path
            d="M88 168 L68 248 M312 168 L332 248"
            fill="none"
            stroke="rgb(255 255 255 / 0.05)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 400 500" className="cw-garment-premium-svg" aria-hidden>
          <defs>
            <linearGradient id={`${uid}-fabric`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e2430" />
              <stop offset="45%" stopColor="#141820" />
              <stop offset="100%" stopColor="#0e1118" />
            </linearGradient>
            <linearGradient id={`${uid}-highlight`} x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
            </linearGradient>
            <radialGradient id={`${uid}-glow`} cx="50%" cy="38%" r="50%">
              <stop offset="0%" stopColor="#52c2c2" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#52c2c2" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="200" cy="250" rx="120" ry="150" fill={`url(#${uid}-glow)`} />
          <path
            d="M72 108 Q200 52 328 108 L348 148 L328 448 L72 448 L52 148 Z"
            fill={`url(#${uid}-fabric)`}
            stroke="rgb(255 255 255 / 0.08)"
            strokeWidth="1.2"
          />
          <path
            d="M72 108 Q200 52 328 108 L348 148 L328 448 L72 448 L52 148 Z"
            fill={`url(#${uid}-highlight)`}
          />
          <path
            d="M138 108 Q200 82 262 108"
            fill="none"
            stroke="rgb(255 255 255 / 0.12)"
            strokeWidth="1.2"
          />
          <path
            d="M88 148 L72 220 M312 148 L328 220"
            fill="none"
            stroke="rgb(255 255 255 / 0.04)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {artworkUrl ? (
        <div className="cw-garment-artwork-layer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artworkUrl}
            alt={title ? `${title} artwork` : "Design artwork"}
            className="cw-garment-artwork-img"
          />
        </div>
      ) : null}
    </div>
  );
}

function GarmentPlaceholder({ garmentType = "tee" }: { garmentType?: GarmentType }) {
  return <PremiumGarmentCanvas garmentType={garmentType} empty subtle />;
}

function formatHealthLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
}
