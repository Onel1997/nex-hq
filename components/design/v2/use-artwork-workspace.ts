"use client";

import {
  analyzeArtwork,
  createAnalyzingAnalysis,
  createIdleAnalysis,
  type ArtworkAnalysisResult,
} from "@/lib/design/artwork-analysis";
import {
  createCheckingValidation,
  createNotUploadedValidation,
  isAcceptedArtworkFile,
  isPreviewableArtworkKind,
  resolveArtworkFileKind,
  validateArtworkFile,
  type ArtworkValidationResult,
} from "@/lib/design/artwork-validation";
import { triggerArtworkFilePicker } from "@/lib/design/artwork-file-picker";
import {
  getActiveWorkspace,
  setPipelineStage,
  type DesignMissionState,
} from "@/lib/design/design-mission-store";
import {
  assertCanContinueToImageStudio,
  assertExactDurableArtworkIdentity,
  buildApproveMasterArtworkBinaryFetch,
  buildDesignStudioHandoffInput,
  buildDesignToImageHandoffRoute,
  DESIGN_ARTWORK_INCOMPLETE_OWNER_ERROR,
  DESIGN_ARTWORK_APPROVAL_OWNER_ERROR,
  DesignToImageHandoffError,
  DESIGN_TO_IMAGE_HANDOFF_OWNER_ERROR,
  parseDurableMasterArtworkResponse,
  resolveCanonicalArtworkForImageHandoff,
  resolveHandoffVersion,
  type DesignArtworkTransferDiagnostic,
} from "@/lib/design/design-to-image-handoff";
import { readArtworkBytesForHandoff } from "@/components/design/v2/artwork-handoff-bytes";
import { sendDesignHandoffToImageStudio } from "@/lib/image/image-handoff-store";
import {
  normalizeOwnerArtworkDisplayName,
  resolveArtworkDisplayName,
} from "@/lib/design/artwork-display-name";
import { resolveMasterArtworkView } from "@/lib/design/master-artwork";
import type { ApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ArtworkPreviewSource,
  ArtworkWorkflowStep,
  LocalArtworkUpload,
  SidebarSectionId,
} from "./types";

function resolveWorkflowStep(input: {
  hasLocalUpload: boolean;
  validation: ArtworkValidationResult;
  analysis: ArtworkAnalysisResult;
  isApproved: boolean;
  mission?: DesignMissionState;
}): ArtworkWorkflowStep {
  const { hasLocalUpload, validation, analysis, isApproved, mission } = input;

  if (!hasLocalUpload) {
    const view = mission ? resolveMasterArtworkView(mission.assets) : null;
    if (!view?.hasArtwork) return "upload";
    if (view.canSendToImageStudio) return "image-studio";
    if (view.isApproved || isApproved) return "approve";
    if (view.state.commercialScore != null) return "commercial-review";
    return "analysis";
  }

  if (validation.status === "not-uploaded" || validation.status === "checking") {
    return "analysis";
  }

  if (validation.status === "invalid") return "analysis";

  if (analysis.status === "analyzing" || analysis.status === "idle") {
    return "analysis";
  }

  if (isApproved) return "approve";

  if (
    analysis.status === "complete" ||
    analysis.status === "unavailable"
  ) {
    return "commercial-review";
  }

  return "analysis";
}

function isAnalysisReady(analysis: ArtworkAnalysisResult): boolean {
  return analysis.status === "complete" || analysis.status === "unavailable";
}

interface UseArtworkWorkspaceOptions {
  mission?: DesignMissionState;
  onPatchMission?: (updater: (state: DesignMissionState) => DesignMissionState) => void;
}

export function useArtworkWorkspace({
  mission,
  onPatchMission,
}: UseArtworkWorkspaceOptions = {}) {
  const router = useRouter();
  const [localUpload, setLocalUpload] = useState<LocalArtworkUpload | null>(null);
  const [localPreviewSvg, setLocalPreviewSvg] = useState<string | undefined>();
  const [validation, setValidation] = useState<ArtworkValidationResult>(createNotUploadedValidation());
  const [analysis, setAnalysis] = useState<ArtworkAnalysisResult>(createIdleAnalysis());
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [transferDiagnostic, setTransferDiagnostic] =
    useState<DesignArtworkTransferDiagnostic | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<SidebarSectionId>("master-artwork");
  const [recentUploads, setRecentUploads] = useState<LocalArtworkUpload[]>([]);
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null);
  const [durableArtwork, setDurableArtwork] =
    useState<ApprovedMasterArtworkView | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pipelineRunRef = useRef(0);
  const localUploadRef = useRef<LocalArtworkUpload | null>(null);
  localUploadRef.current = localUpload;

  const missionView = useMemo(
    () => (mission ? resolveMasterArtworkView(mission.assets) : null),
    [mission],
  );

  const health = useMemo(
    () => (mission ? getActiveWorkspace(mission).health : undefined),
    [mission],
  );

  const originalFileName =
    localUpload?.fileName ??
    validation.metadata?.fileName ??
    durableArtwork?.originalFileName ??
    null;

  const artworkIdentity = useMemo(
    () =>
      resolveArtworkDisplayName({
        userFacingTitle: ownerDisplayName ?? durableArtwork?.displayName,
        fileName: originalFileName,
        durableDisplayName: missionView?.state.vectorArtworkLabel,
        designId: mission?.brief.designId,
        researchTitle: mission?.brief.title ?? mission?.reportTitle,
      }),
    [
      durableArtwork?.displayName,
      mission?.brief.designId,
      mission?.brief.title,
      mission?.reportTitle,
      missionView?.state.vectorArtworkLabel,
      originalFileName,
      ownerDisplayName,
    ],
  );

  const missionPreview = useMemo((): ArtworkPreviewSource | null => {
    if (!missionView?.hasArtwork || localUpload) return null;
    return {
      imageUrl: missionView.previewImageUrl,
      svgMarkup: missionView.previewSvgMarkup,
      fileName: artworkIdentity.displayName,
      mimeType: missionView.previewSvgMarkup ? "image/svg+xml" : "image/png",
      source: "mission",
    };
  }, [artworkIdentity.displayName, localUpload, missionView]);

  const resolvedPreview = useMemo((): ArtworkPreviewSource | null => {
    if (localUpload) {
      const kind = resolveArtworkFileKind(localUpload.file);
      if (!isPreviewableArtworkKind(kind)) {
        return {
          fileName: localUpload.fileName,
          mimeType: localUpload.mimeType,
          source: "upload",
        };
      }

      const isSvg = kind === "svg";
      return {
        imageUrl: isSvg ? undefined : localUpload.objectUrl,
        svgMarkup: isSvg ? localPreviewSvg : undefined,
        fileName: localUpload.fileName,
        mimeType: localUpload.mimeType,
        source: "upload",
      };
    }
    return missionPreview;
  }, [localPreviewSvg, localUpload, missionPreview]);

  const hasArtwork = Boolean(localUpload || missionPreview);
  const workflowStep = resolveWorkflowStep({
    hasLocalUpload: Boolean(localUpload),
    validation,
    analysis,
    isApproved,
    mission,
  });

  const runPipeline = useCallback(async (upload: LocalArtworkUpload) => {
    const runId = ++pipelineRunRef.current;
    setValidation(createCheckingValidation());
    setAnalysis(createAnalyzingAnalysis());
    setUploadError(null);

    const validationResult = await validateArtworkFile(
      upload.file,
      upload.objectUrl,
      upload.uploadedAt,
    );

    if (runId !== pipelineRunRef.current) return;

    setValidation(validationResult);

    if (validationResult.svgMarkup) {
      setLocalPreviewSvg(validationResult.svgMarkup);
    }

    if (validationResult.status === "invalid") {
      const reason = validationResult.issues.find((i) => i.severity === "error")?.message;
      setUploadError(reason ?? "Die Dateiprüfung ist fehlgeschlagen.");
      setAnalysis(createIdleAnalysis());
      return;
    }

    if (!validationResult.metadata) {
      setAnalysis(createIdleAnalysis());
      return;
    }

    const analysisResult = await analyzeArtwork({
      file: upload.file,
      objectUrl: upload.objectUrl,
      metadata: validationResult.metadata,
      svgMarkup: validationResult.svgMarkup,
    });

    if (runId !== pipelineRunRef.current) return;
    setAnalysis(analysisResult);
  }, []);

  const ingestFile = useCallback(
    (file: File) => {
      if (!isAcceptedArtworkFile(file)) {
        setUploadError("Nicht unterstützter Dateityp. Verwende PNG, SVG, PDF, AI oder EPS.");
        return false;
      }

      if (localUpload?.objectUrl) {
        URL.revokeObjectURL(localUpload.objectUrl);
      }

      const kind = resolveArtworkFileKind(file);
      const objectUrl = URL.createObjectURL(file);
      const upload: LocalArtworkUpload = {
        file,
        objectUrl,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        isPreviewable: isPreviewableArtworkKind(kind),
        fileKind: kind,
      };

      localUploadRef.current = upload;
      setLocalUpload(upload);
      setLocalPreviewSvg(undefined);
      setIsApproved(false);
      setDurableArtwork(null);
      setUploadError(null);
      setApprovalError(null);
      setHandoffError(null);
      setTransferDiagnostic(null);
      setOwnerDisplayName(null);
      setRenameError(null);
      setAnalysis(createIdleAnalysis());
      setRecentUploads((prev) =>
        [upload, ...prev.filter((u) => u.fileName !== file.name)].slice(0, 8),
      );
      setActiveSidebarSection("master-artwork");
      void runPipeline(upload);
      return true;
    },
    [localUpload?.objectUrl, runPipeline],
  );

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      ingestFile(file);
    },
    [ingestFile],
  );

  const openFilePicker = useCallback(() => {
    triggerArtworkFilePicker(fileInputRef.current);
  }, []);

  const clearLocalUpload = useCallback(() => {
    pipelineRunRef.current += 1;
    if (localUpload?.objectUrl) {
      URL.revokeObjectURL(localUpload.objectUrl);
    }
    localUploadRef.current = null;
    setLocalUpload(null);
    setLocalPreviewSvg(undefined);
    setValidation(createNotUploadedValidation());
    setAnalysis(createIdleAnalysis());
    setUploadError(null);
    setIsApproved(false);
    setDurableArtwork(null);
    setApprovalError(null);
    setTransferDiagnostic(null);
    setOwnerDisplayName(null);
    setRenameError(null);
  }, [localUpload]);

  const approveArtwork = useCallback(async () => {
    if (!validation.canApprove || !isAnalysisReady(analysis)) return;
    if (!localUpload || !mission?.brief.designId) {
      setApprovalError(DESIGN_ARTWORK_APPROVAL_OWNER_ERROR);
      return;
    }

    setApprovalBusy(true);
    setApprovalError(null);
    setHandoffError(null);
    setTransferDiagnostic(null);
    try {
      const { bytes, mimeType } = await readArtworkBytesForHandoff(localUpload);
      const version = resolveHandoffVersion(mission);
      const approvalFetch = await buildApproveMasterArtworkBinaryFetch({
        bytes,
        designId: mission.brief.designId,
        version,
        reportId: mission.reportId,
        mimeType,
        placement: mission.brief.placement ?? null,
        printMethod: mission.brief.productionMethod ?? null,
        displayName: ownerDisplayName,
        originalFileName: localUpload.fileName,
      });
      const response = await fetch(approvalFetch.url, approvalFetch.init);
      const payload = (await response.json()) as {
        artwork?: ApprovedMasterArtworkView;
        error?: string;
        code?: string;
        stage?: string;
        requestId?: string;
        details?: {
          expectedByteLength?: number;
          receivedByteLength?: number;
        };
      };
      if (!response.ok || !payload.artwork) {
        throw new DesignToImageHandoffError(DESIGN_ARTWORK_APPROVAL_OWNER_ERROR, {
          operation: "approval_persist",
          status: response.status,
          code: payload.code,
          requestId: payload.requestId,
          designId: mission.brief.designId,
          version,
          expectedByteLength: payload.details?.expectedByteLength,
          receivedByteLength: payload.details?.receivedByteLength,
          message: payload.error ?? "Durable Artwork approval was not persisted.",
        });
      }
      const approved = parseDurableMasterArtworkResponse(payload);
      setDurableArtwork(approved);
      setOwnerDisplayName(approved.displayName ?? ownerDisplayName);
      setIsApproved(true);
    } catch (error) {
      const diagnostic =
        error instanceof DesignToImageHandoffError
          ? error.diagnostic
          : {
              operation: "approval_persist" as const,
              designId: mission.brief.designId,
              version: resolveHandoffVersion(mission),
              message: error instanceof Error ? error.message : "Unknown approval error",
            };
      console.error("[Design Studio] durable Artwork approval failed", diagnostic);
      setTransferDiagnostic(diagnostic ?? null);
      setApprovalError(
        diagnostic?.message === DESIGN_ARTWORK_INCOMPLETE_OWNER_ERROR
          ? DESIGN_ARTWORK_INCOMPLETE_OWNER_ERROR
          : DESIGN_ARTWORK_APPROVAL_OWNER_ERROR,
      );
      setIsApproved(false);
    } finally {
      setApprovalBusy(false);
    }
  }, [analysis, localUpload, mission, ownerDisplayName, validation]);

  const canContinueToImageStudio =
    isApproved &&
    Boolean(durableArtwork) &&
    Boolean(localUpload) &&
    Boolean(mission?.brief.designId) &&
    validation.status !== "invalid" &&
    validation.status !== "checking" &&
    Boolean(validation.metadata);

  const continueToImageStudio = useCallback(async () => {
    setHandoffError(null);
    setHandoffBusy(true);
    try {
      assertCanContinueToImageStudio({
        isApproved,
        hasLocalUpload: Boolean(localUpload),
        validation,
        mission,
      });
      if (!localUpload || !mission) {
        throw new DesignToImageHandoffError(
          "Lade das Artwork hoch und gib es frei, bevor du ins Image Studio wechselst.",
        );
      }

      if (!durableArtwork) {
        throw new DesignToImageHandoffError(DESIGN_TO_IMAGE_HANDOFF_OWNER_ERROR, {
          operation: "authority_resolve",
          designId: mission.brief.designId,
          version: resolveHandoffVersion(mission),
          message: "No persisted approved Artwork is selected.",
        });
      }

      const canonicalArtwork = await resolveCanonicalArtworkForImageHandoff(
        durableArtwork.id,
      );
      assertExactDurableArtworkIdentity(canonicalArtwork, durableArtwork);
      setDurableArtwork(canonicalArtwork);
      if (canonicalArtwork.displayName) {
        setOwnerDisplayName(canonicalArtwork.displayName);
      }

      const saveResult = sendDesignHandoffToImageStudio(
        buildDesignStudioHandoffInput({
          mission,
          durableArtwork: canonicalArtwork,
          artworkFileName: localUpload.fileName,
        }),
      );
      if (!saveResult.saved) {
        throw new DesignToImageHandoffError(DESIGN_TO_IMAGE_HANDOFF_OWNER_ERROR, {
          operation: "handoff_store",
          artworkId: canonicalArtwork.id,
          designId: canonicalArtwork.designId,
          version: canonicalArtwork.version,
          message: saveResult.error ?? "Browser handoff state could not be persisted.",
        });
      }

      onPatchMission?.((state) => setPipelineStage(state, "image"));
      router.push(buildDesignToImageHandoffRoute(canonicalArtwork.id));
    } catch (error) {
      const diagnostic =
        error instanceof DesignToImageHandoffError
          ? error.diagnostic
          : {
              operation: "authority_resolve" as const,
              artworkId: durableArtwork?.id,
              designId: mission?.brief.designId,
              version: durableArtwork?.version,
              message: error instanceof Error ? error.message : "Unknown handoff error",
            };
      console.error("[Design Studio] Image Studio handoff failed", diagnostic);
      setTransferDiagnostic(diagnostic ?? null);
      setHandoffError(DESIGN_TO_IMAGE_HANDOFF_OWNER_ERROR);
    } finally {
      setHandoffBusy(false);
    }
  }, [
    isApproved,
    localUpload,
    mission,
    onPatchMission,
    durableArtwork,
    router,
    validation,
  ]);

  useEffect(() => {
    return () => {
      if (localUpload?.objectUrl) {
        URL.revokeObjectURL(localUpload.objectUrl);
      }
    };
  }, [localUpload?.objectUrl]);

  useEffect(() => {
    const designId = mission?.brief.designId;
    if (!designId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/design/master-artworks?designId=${encodeURIComponent(designId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          artworks?: ApprovedMasterArtworkView[];
        };
        const latest = payload.artworks?.[0];
        if (cancelled || !latest) return;
        if (localUploadRef.current) return;
        setDurableArtwork(latest);
        setOwnerDisplayName((current) => {
          if (localUploadRef.current) return current;
          return current ?? latest.displayName ?? null;
        });
      } catch {
        /* durable library may be unmigrated */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mission?.brief.designId]);

  const renameArtworkDisplayName = useCallback(
    async (rawName: string) => {
      const normalized = normalizeOwnerArtworkDisplayName(rawName);
      if (!normalized.ok) {
        setRenameError(normalized.error);
        return false;
      }
      setRenameError(null);
      const persistedId = durableArtwork?.id;
      if (persistedId) {
        setRenameBusy(true);
        try {
          const response = await fetch(`/api/design/master-artworks/${persistedId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName: normalized.value }),
          });
          const payload = (await response.json()) as {
            artwork?: ApprovedMasterArtworkView;
            error?: string;
          };
          if (!response.ok || !payload.artwork) {
            throw new Error(payload.error ?? "Der Artwork-Name konnte nicht gespeichert werden.");
          }
          setDurableArtwork(payload.artwork);
          setOwnerDisplayName(payload.artwork.displayName ?? normalized.value);
          return true;
        } catch (error) {
          setRenameError(
            error instanceof Error
              ? error.message
              : "Der Artwork-Name konnte nicht gespeichert werden.",
          );
          return false;
        } finally {
          setRenameBusy(false);
        }
      }
      setOwnerDisplayName(normalized.value);
      return true;
    },
    [durableArtwork?.id],
  );

  const canApprove =
    validation.canApprove &&
    Boolean(localUpload) &&
    isAnalysisReady(analysis) &&
    !approvalBusy &&
    !isApproved;

  return {
    mission,
    missionView,
    health,
    preview: resolvedPreview,
    artworkIdentity,
    originalFileName,
    hasArtwork,
    workflowStep,
    localUpload,
    validation,
    analysis,
    uploadError,
    handoffError,
    handoffBusy,
    approvalBusy,
    approvalError,
    transferDiagnostic,
    renameError,
    renameBusy,
    isApproved,
    canApprove,
    canContinueToImageStudio,
    recentUploads,
    activeSidebarSection,
    setActiveSidebarSection,
    fileInputRef,
    handleFileSelect,
    openFilePicker,
    ingestFile,
    clearLocalUpload,
    approveArtwork,
    continueToImageStudio,
    renameArtworkDisplayName,
    versionHistory: mission?.versionHistory ?? [],
  };
}
