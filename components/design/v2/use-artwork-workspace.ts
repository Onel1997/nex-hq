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
import {
  getActiveWorkspace,
  type DesignMissionState,
} from "@/lib/design/design-mission-store";
import { resolveMasterArtworkView } from "@/lib/design/master-artwork";
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
}

export function useArtworkWorkspace({ mission }: UseArtworkWorkspaceOptions = {}) {
  const [localUpload, setLocalUpload] = useState<LocalArtworkUpload | null>(null);
  const [localPreviewSvg, setLocalPreviewSvg] = useState<string | undefined>();
  const [validation, setValidation] = useState<ArtworkValidationResult>(createNotUploadedValidation());
  const [analysis, setAnalysis] = useState<ArtworkAnalysisResult>(createIdleAnalysis());
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<SidebarSectionId>("master-artwork");
  const [recentUploads, setRecentUploads] = useState<LocalArtworkUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pipelineRunRef = useRef(0);

  const missionView = useMemo(
    () => (mission ? resolveMasterArtworkView(mission.assets) : null),
    [mission],
  );

  const health = useMemo(
    () => (mission ? getActiveWorkspace(mission).health : undefined),
    [mission],
  );

  const missionPreview = useMemo((): ArtworkPreviewSource | null => {
    if (!missionView?.hasArtwork || localUpload) return null;
    return {
      imageUrl: missionView.previewImageUrl,
      svgMarkup: missionView.previewSvgMarkup,
      fileName: mission?.brief.title,
      mimeType: missionView.previewSvgMarkup ? "image/svg+xml" : "image/png",
      source: "mission",
    };
  }, [localUpload, mission?.brief.title, missionView]);

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
      setUploadError(reason ?? "File validation failed.");
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
        setUploadError("Unsupported file type. Use PNG, SVG, PDF, AI, or EPS.");
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

      setLocalUpload(upload);
      setLocalPreviewSvg(undefined);
      setIsApproved(false);
      setUploadError(null);
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
    fileInputRef.current?.click();
  }, []);

  const clearLocalUpload = useCallback(() => {
    pipelineRunRef.current += 1;
    if (localUpload?.objectUrl) {
      URL.revokeObjectURL(localUpload.objectUrl);
    }
    setLocalUpload(null);
    setLocalPreviewSvg(undefined);
    setValidation(createNotUploadedValidation());
    setAnalysis(createIdleAnalysis());
    setUploadError(null);
    setIsApproved(false);
  }, [localUpload]);

  const approveArtwork = useCallback(() => {
    if (!validation.canApprove || !isAnalysisReady(analysis)) return;
    setIsApproved(true);
  }, [analysis, validation.canApprove]);

  useEffect(() => {
    return () => {
      if (localUpload?.objectUrl) {
        URL.revokeObjectURL(localUpload.objectUrl);
      }
    };
  }, [localUpload?.objectUrl]);

  const canApprove =
    validation.canApprove &&
    Boolean(localUpload) &&
    isAnalysisReady(analysis) &&
    !isApproved;

  return {
    mission,
    missionView,
    health,
    preview: resolvedPreview,
    hasArtwork,
    workflowStep,
    localUpload,
    validation,
    analysis,
    uploadError,
    isApproved,
    canApprove,
    recentUploads,
    activeSidebarSection,
    setActiveSidebarSection,
    fileInputRef,
    handleFileSelect,
    openFilePicker,
    ingestFile,
    clearLocalUpload,
    approveArtwork,
    versionHistory: mission?.versionHistory ?? [],
  };
}
