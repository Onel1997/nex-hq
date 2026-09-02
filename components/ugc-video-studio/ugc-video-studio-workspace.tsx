"use client";

import {
  Bookmark,
  CheckCircle2,
  Clipboard,
  Download,
  Heart,
  History,
  Loader2,
  Maximize2,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  UgcAdvancedPanel,
  UgcKlingDurationSelector,
  UgcKlingMotionControls,
  UgcModeSelector,
  UgcModelSelector,
  UgcPromptSaveDialog,
  UgcQuickControls,
  UgcReferenceUploader,
  UgcVideoEditSettings,
  UgcVideoEditUploader,
  UgcBaseVideoSettings,
  UgcBaseVideoUploader,
} from "@/components/ugc-video-studio/ugc-video-studio-controls";
import {
  UgcProviderDetails,
  UgcPromptLibrary,
  UgcRunHistory,
} from "@/components/ugc-video-studio/ugc-video-studio-library";
import { UgcResultVideo } from "@/components/ugc-video-studio/ugc-result-video";
import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
  DEFAULT_UGC_VIDEO_EDIT_SETTINGS,
  DEFAULT_UGC_BASE_VIDEO_SETTINGS,
  UGC_VIDEO_AUDIO_REFERENCE_LIMIT,
  UGC_VIDEO_IMAGE_REFERENCE_LIMIT,
  UGC_VIDEO_REFERENCE_MAX_BYTES,
  UGC_VIDEO_REFERENCE_MIME_TYPES,
  UGC_VIDEO_REFERENCE_TOTAL_MAX_BYTES,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  UGC_VIDEO_TYPE_LABELS,
  UGC_VIDEO_TYPES,
  UGC_VIDEO_VIDEO_REFERENCE_LIMIT,
  ugcVideoGenerationSetupSchema,
  type SavedUgcVideoPrompt,
  type UgcVideoGenerationSetup,
  type UgcVideoPersistedState,
  type UgcVideoReferenceMedia,
  type UgcVideoReferenceRole,
  type UgcVideoReferenceType,
  type UgcVideoResult,
  type UgcVideoRun,
  type UgcVideoMode,
} from "@/lib/ugc-video-studio/contracts";
import {
  DEFAULT_BASE_VIDEO_MODEL_ID,
  baseVideoClientModel,
  baseVideoOwnerEstimateKey,
} from "@/lib/ugc-video-studio/base-video-models";
import {
  fetchUgcVideoJob,
  submitUgcVideoGeneration,
  UgcVideoGenerationClientError,
} from "@/lib/ugc-video-studio/client";
import { createUgcVideoClientId } from "@/lib/ugc-video-studio/client-id";
import { copyUgcPromptText } from "@/lib/ugc-video-studio/clipboard";
import {
  DEFAULT_UGC_VIDEO_MODEL_ID,
  AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID,
  RECOMMENDED_VIDEO_EDIT_MODEL_ID,
  UGC_VIDEO_MODEL_REGISTRY,
  isUgcVideoEditModelId,
  ugcVideoModelById,
} from "@/lib/ugc-video-studio/model-registry";
import {
  loadUgcVideoState,
  removeUgcVideoPrompt,
  saveUgcVideoState,
  upsertUgcVideoPrompt,
  upsertUgcVideoRun,
} from "@/lib/ugc-video-studio/persistence";
import { resolveUgcGenerateReadiness } from "@/lib/ugc-video-studio/readiness";
import {
  assertKlingMotionReferences,
  KlingMotionReferenceError,
  resolveKlingMotionReferences,
} from "@/lib/ugc-video-studio/kling-motion-config";
import {
  assertUgcVideoEditSetup,
  UgcVideoEditInputError,
} from "@/lib/ugc-video-studio/video-edit-config";
import type { UgcVideoProviderPublicConfig } from "@/lib/ugc-video-studio/provider-config";
import type { XerianoUgcCustomerConfig } from "@/lib/xeriano/customer-config";
import type { XerianoCustomerStudioStatus } from "@/lib/xeriano/client-contracts";
import { quoteXerianoCredits } from "@/lib/xeriano/pricing";
import {
  deleteXerianoTempReference,
  uploadXerianoTempReference,
} from "@/lib/xeriano/temp-references/client";

type StudioView = "CREATE" | "PROMPTS" | "HISTORY";

const QUICK_TAGS = [
  "iPhone UGC",
  "Handheld",
  "Mirror Fit Check",
  "Bedroom",
  "Street Walk",
  "Product Detail",
  "Natural Daylight",
  "TikTok Style",
] as const;

function nowIso() {
  return new Date().toISOString();
}

function mediaTypeFromMime(mimeType: string): UgcVideoReferenceType | null {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return null;
}

function referenceMetadata(reference: UgcVideoReferenceMedia) {
  return {
    id: reference.id,
    name: reference.name,
    mimeType: reference.mimeType,
    mediaType: reference.mediaType,
    byteLength: reference.byteLength,
    durationSeconds: reference.durationSeconds,
    role: reference.role,
    order: reference.order,
  };
}

function createReference(file: File, order: number): UgcVideoReferenceMedia {
  const mediaType = mediaTypeFromMime(file.type);
  if (!mediaType) throw new Error("unsupported_reference_type");
  return {
    id: createUgcVideoClientId(),
    name: file.name,
    mimeType: file.type,
    mediaType,
    byteLength: file.size,
    durationSeconds: null,
    role: "NONE",
    order,
    previewUrl: URL.createObjectURL(file),
    file,
    tempReferenceId: null,
    uploadState: "UPLOADING",
  };
}

function uploadUgcReference(
  reference: UgcVideoReferenceMedia,
  update: (id: string, value: Pick<UgcVideoReferenceMedia, "tempReferenceId" | "uploadState">) => void,
) {
  void uploadXerianoTempReference({
    studio: "UGC_VIDEO_STUDIO",
    kind: reference.mediaType,
    file: reference.file,
  })
    .then(({ tempReferenceId }) =>
      update(reference.id, { tempReferenceId, uploadState: "READY" }),
    )
    .catch(() =>
      update(reference.id, { tempReferenceId: null, uploadState: "FAILED" }),
    );
}

export function UgcVideoStudioWorkspace(props: {
  providerConfig?: UgcVideoProviderPublicConfig;
  customerConfig?: XerianoUgcCustomerConfig;
  customerStatus?: XerianoCustomerStudioStatus;
  customerMode?: boolean;
  ownerMode?: boolean;
  baseVideoOwnerPilot?: boolean;
  initialModelId?: string;
  initialLibraryAssetId?: string;
}) {
  const productMode = Boolean(props.customerMode || props.ownerMode);
  const [view, setView] = useState<StudioView>("CREATE");
  const [persisted, setPersisted] = useState<UgcVideoPersistedState>({
    version: 1,
    prompts: [],
    runs: [],
  });
  const [references, setReferences] = useState<UgcVideoReferenceMedia[]>([]);
  const [prompt, setPrompt] = useState("");
  const initialVideoEdit = isUgcVideoEditModelId(props.initialModelId ?? "");
  const [mode, setMode] = useState<UgcVideoMode>(initialVideoEdit ? "VIDEO_EDIT" : "MOTION_CONTROL");
  const [modelId, setModelId] = useState<string>(
    props.initialModelId ?? DEFAULT_UGC_VIDEO_MODEL_ID,
  );
  const [recommendedSelected, setRecommendedSelected] = useState(false);
  const [duration, setDuration] =
    useState<UgcVideoGenerationSetup["duration"]>("5");
  const [aspectRatio, setAspectRatio] =
    useState<UgcVideoGenerationSetup["aspectRatio"]>("9:16");
  const [quality, setQuality] =
    useState<UgcVideoGenerationSetup["quality"]>("720p");
  const [bitrate, setBitrate] =
    useState<UgcVideoGenerationSetup["bitrate"]>("STANDARD");
  const [videoType, setVideoType] =
    useState<UgcVideoGenerationSetup["videoType"]>("UGC");
  const [advanced, setAdvanced] = useState<
    UgcVideoGenerationSetup["advanced"]
  >({ ...DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS });
  const [klingMotion, setKlingMotion] = useState<
    UgcVideoGenerationSetup["klingMotion"]
  >({ ...DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS });
  const [videoEdit, setVideoEdit] = useState<UgcVideoGenerationSetup["videoEdit"]>({
    ...DEFAULT_UGC_VIDEO_EDIT_SETTINGS,
  });
  const [baseVideo, setBaseVideo] = useState<UgcVideoGenerationSetup["baseVideo"]>({
    ...DEFAULT_UGC_BASE_VIDEO_SETTINGS,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] =
    useState<SavedUgcVideoPrompt | null>(null);
  const [saveSource, setSaveSource] =
    useState<UgcVideoGenerationSetup | null>(null);
  const [activeRun, setActiveRun] = useState<UgcVideoRun | null>(null);
  const [availableCredits, setAvailableCredits] = useState(
    props.customerStatus?.availableCredits ?? 0,
  );
  const [largeResult, setLargeResult] = useState<UgcVideoResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "INFO" | "SUCCESS" | "ERROR";
    text: string;
    details?: string;
  } | null>(null);
  const referencesRef = useRef(references);
  const generationLockRef = useRef(false);
  const initialLibraryAssetLoadedRef = useRef(false);
  const statusPollInFlightRef = useRef(false);
  const observeActiveRunNowRef = useRef<() => void>(() => undefined);
  referencesRef.current = references;

  useEffect(() => {
    let cancelled = false;
    const restored = loadUgcVideoState(window.localStorage);
    const restoredRun =
      restored.runs.find((run) => run.status === "RUNNING") ??
      restored.runs[0] ??
      null;
    setPersisted(restored);
    setActiveRun(restoredRun);
    if (restoredRun?.status === "SUCCEEDED") {
      void fetchUgcVideoJob({
        jobId: restoredRun.id,
        ...(props.customerMode
          ? { onCredit: (receipt) => setAvailableCredits(receipt.availableCredits) }
          : {}),
      }).then((fresh) => {
        if (cancelled) return;
        const saved = saveUgcVideoState(
          window.localStorage,
          upsertUgcVideoRun(loadUgcVideoState(window.localStorage), fresh),
        );
        setPersisted(saved);
        setActiveRun(fresh);
      }).catch(() => undefined);
    }
    return () => {
      cancelled = true;
      referencesRef.current.forEach((reference) =>
        URL.revokeObjectURL(reference.previewUrl),
      );
    };
  }, [props.customerMode]);

  const persist = useCallback((next: UgcVideoPersistedState) => {
    const saved = saveUgcVideoState(window.localStorage, next);
    setPersisted(saved);
  }, []);

  useEffect(() => {
    if (activeRun?.status !== "RUNNING") return;
    let cancelled = false;
    let lastResumeObservationAt = 0;
    const poll = async () => {
      if (
        cancelled ||
        document.visibilityState === "hidden" ||
        statusPollInFlightRef.current
      ) return;
      statusPollInFlightRef.current = true;
      try {
        const run = await fetchUgcVideoJob({
          jobId: activeRun.id,
          ...(props.customerMode
            ? { onCredit: (receipt) => setAvailableCredits(receipt.availableCredits) }
            : {}),
        });
        if (cancelled) return;
        persist(upsertUgcVideoRun(loadUgcVideoState(window.localStorage), run));
        setActiveRun(run);
        if (run.status === "SUCCEEDED") {
          setNotice({
            kind: "SUCCESS",
            text: run.message ?? "Dein Video wurde erfolgreich erstellt.",
          });
        } else if (
          run.status === "FAILED" ||
          run.status === "UNKNOWN_OUTCOME"
        ) {
          setNotice({
            kind: "ERROR",
            text:
              run.message ??
              (run.status === "FAILED"
                ? "Das Video konnte nicht erstellt werden."
                : "Der Anbieterstatus ist unklar. Es wird kein neuer Auftrag gestartet."),
          });
        }
      } catch {
        // A transient NexHQ status request must not alter paid-job authority.
        // The persisted RUNNING job is checked again on the next interval.
      } finally {
        statusPollInFlightRef.current = false;
      }
    };
    const observeNow = () => { void poll(); };
    observeActiveRunNowRef.current = observeNow;
    const first = window.setTimeout(poll, 3_000);
    const interval = window.setInterval(poll, 3_000);
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastResumeObservationAt < 1_000) return;
      lastResumeObservationAt = now;
      void poll();
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
      if (observeActiveRunNowRef.current === observeNow) {
        observeActiveRunNowRef.current = () => undefined;
      }
    };
  }, [activeRun?.id, activeRun?.providerRequestId, activeRun?.status, persist, props.customerMode]);

  const selectedModel =
    ugcVideoModelById(modelId) ?? UGC_VIDEO_MODEL_REGISTRY[0]!;
  const effectiveLimit = selectedModel.maximumReferences;
  const selectedProviderConfig = props.providerConfig && Object.hasOwn(props.providerConfig.models, selectedModel.id)
    ? props.providerConfig.models[selectedModel.id as keyof typeof props.providerConfig.models]
    : null;
  const klingResolution = resolveKlingMotionReferences({
    references: references.map(referenceMetadata),
    klingMotion,
  });
  const ownerSeedanceEstimateKey = `${quality}|${aspectRatio}|${duration}|${references.some((reference) => reference.mediaType === "VIDEO") ? "video" : "image"}`;
  const selectedKlingSeconds = Number(duration);
  const selectedMotionSourceSeconds =
    klingResolution.motionVideo?.durationSeconds ?? null;
  const sourceVideo = references.find((reference) =>
    reference.id === videoEdit.sourceVideoReferenceId,
  ) ?? (references.filter((reference) => reference.mediaType === "VIDEO").length === 1
    ? references.find((reference) => reference.mediaType === "VIDEO")!
    : null);
  const characterMaster = references.find((reference) =>
    reference.id === videoEdit.characterMasterReferenceId,
  ) ?? (references.filter((reference) => reference.mediaType === "IMAGE").length === 1
    ? references.find((reference) => reference.mediaType === "IMAGE")!
    : null);
  const selectedBaseVideoModel = baseVideoClientModel(modelId);
  const startImage = references.find(
    (reference) => reference.id === baseVideo.startImageReferenceId,
  ) ?? null;
  const baseVideoVariant = startImage && selectedBaseVideoModel?.supportsImageToVideo
    ? "IMAGE_TO_VIDEO" as const
    : selectedBaseVideoModel?.supportsTextToVideo
      ? "TEXT_TO_VIDEO" as const
      : "IMAGE_TO_VIDEO" as const;
  const selectedBaseVideoVariant = selectedBaseVideoModel?.variants[baseVideoVariant] ?? null;
  const effectiveBaseVideo = useMemo(() => ({
    ...baseVideo,
    variant: baseVideoVariant,
    startImageReferenceId:
      selectedBaseVideoModel?.supportsImageToVideo && startImage
        ? startImage.id
        : null,
  }), [baseVideo, baseVideoVariant, selectedBaseVideoModel, startImage]);
  const activeReferences = useMemo(() => mode === "VIDEO_EDIT"
    ? [sourceVideo, characterMaster]
        .filter((reference): reference is UgcVideoReferenceMedia => Boolean(reference))
        .map((reference, order) => ({ ...reference, order }))
    : mode === "BASE_VIDEO"
      ? startImage && selectedBaseVideoModel?.supportsImageToVideo
        ? [{ ...startImage, order: 0 }]
        : []
      : references, [characterMaster, mode, references, selectedBaseVideoModel, sourceVideo, startImage]);
  const selectedSourceSeconds = sourceVideo?.durationSeconds ?? null;
  const klingDurationAllowed =
    mode === "BASE_VIDEO"
      ? Boolean(selectedBaseVideoModel?.supportedDurations.includes(duration))
      : mode === "VIDEO_EDIT"
      ? selectedSourceSeconds === null || selectedKlingSeconds <= selectedSourceSeconds + 0.05
      : selectedModel.id !== "kling-v3-pro-motion-control" ||
        (selectedKlingSeconds <=
      (klingMotion.characterOrientation === "IMAGE" ? 10 : 30) &&
      (selectedMotionSourceSeconds === null ||
        selectedKlingSeconds <= selectedMotionSourceSeconds + 0.05));
  useEffect(() => {
    if (
      selectedModel.id === "kling-v3-pro-motion-control" &&
      selectedKlingSeconds >
        (klingMotion.characterOrientation === "IMAGE" ? 10 : 30)
    ) {
      setDuration("5");
    }
  }, [
    klingMotion.characterOrientation,
    selectedKlingSeconds,
    selectedModel.id,
  ]);
  const baseVideoEstimateKey = selectedBaseVideoModel && selectedBaseVideoVariant
    ? baseVideoOwnerEstimateKey({
        modelId: selectedBaseVideoModel.id,
        variant: baseVideoVariant,
        duration,
        resolution: effectiveBaseVideo.resolution,
        generateAudio: effectiveBaseVideo.generateAudio,
      })
    : null;
  const estimatedMaximumCostUsd = props.customerMode
    ? null
    : selectedModel.id === "seedance-2.5"
      ? props.providerConfig?.ownerPricing.seedanceEstimatesUsd[
          ownerSeedanceEstimateKey
        ] ?? null
      : selectedModel.id === "kling-v3-pro-motion-control"
        ? Number(
            (
              selectedKlingSeconds *
              (props.providerConfig?.ownerPricing.klingPerSecondUsd ?? 0)
            ).toFixed(2),
          )
        : isUgcVideoEditModelId(selectedModel.id)
          ? props.providerConfig?.ownerPricing.videoEditEstimatesUsd[`${selectedModel.id}|${duration}`] ?? null
          : mode === "BASE_VIDEO" && baseVideoEstimateKey
            ? props.providerConfig?.ownerPricing.baseVideoEstimatesUsd[baseVideoEstimateKey] ?? null
          : null;
  const customerBillableSeconds =
    selectedModel.id === "kling-v3-pro-motion-control" || isUgcVideoEditModelId(selectedModel.id)
      ? selectedKlingSeconds
      : null;
  const customerCredits = customerBillableSeconds
    ? quoteXerianoCredits({
        modelId: selectedModel.id as "kling-v3-pro-motion-control" | "kling-o3-pro-video-edit" | "kling-o1-standard-video-edit" | "seedance-2-fast-video-edit",
        durationSeconds: customerBillableSeconds,
      })
    : null;
  const selectedCustomerModelConfig = props.customerConfig && Object.hasOwn(props.customerConfig.models, selectedModel.id)
    ? props.customerConfig.models[selectedModel.id as keyof typeof props.customerConfig.models]
    : undefined;
  const customerModelUnavailable = Boolean(
    props.customerMode &&
      (!selectedCustomerModelConfig?.customerAvailable ||
        !selectedCustomerModelConfig.ready),
  );
  const insufficientCustomerCredits = Boolean(
    props.customerMode &&
      customerCredits !== null &&
      availableCredits < customerCredits,
  );
  const customerConcurrencyReached = Boolean(
    props.customerMode &&
      props.customerStatus &&
      props.customerStatus.activeVideoJobs >=
        props.customerStatus.videoConcurrencyLimit,
  );
  const generateReadiness = resolveUgcGenerateReadiness({
    mode,
    generating,
    activeJobRunning: activeRun?.status === "RUNNING",
    promptPresent: Boolean(prompt.trim()),
    promptAllowed:
      mode !== "BASE_VIDEO" ||
      modelId !== "pixverse-c1-base" ||
      new TextEncoder().encode(prompt).byteLength <= 2048,
    sourceVideoPresent: Boolean(sourceVideo),
    characterMasterPresent: Boolean(characterMaster),
    startImageRequired: Boolean(
      mode === "BASE_VIDEO" &&
        selectedBaseVideoModel &&
        !selectedBaseVideoModel.supportsTextToVideo,
    ),
    startImagePresent: Boolean(startImage),
    references: activeReferences,
    durationAllowed: klingDurationAllowed,
    aspectAllowed:
      mode !== "BASE_VIDEO" ||
      Boolean(selectedBaseVideoVariant?.aspectRatios.includes(aspectRatio)),
    resolutionAllowed:
      mode !== "BASE_VIDEO" ||
      Boolean(
        selectedBaseVideoVariant?.resolutions.includes(
          effectiveBaseVideo.resolution,
        ),
      ),
    audioAllowed:
      mode !== "BASE_VIDEO" ||
      !effectiveBaseVideo.generateAudio ||
      Boolean(selectedBaseVideoVariant?.audioSupported),
    customerMode: Boolean(props.customerMode),
    ownerMode: Boolean(props.ownerMode),
    customerModelUnavailable,
    ownerModelUnavailable: Boolean(
      mode === "BASE_VIDEO" &&
        (!props.baseVideoOwnerPilot ||
          !props.providerConfig?.baseVideoOwnerPilot.ready),
    ),
    customerCredits,
    insufficientCustomerCredits,
    customerConcurrencyReached,
    ownerEstimateUsd: estimatedMaximumCostUsd,
  });
  const generateLabel = generateReadiness.ready
    ? props.customerMode && customerCredits !== null
      ? `Generieren · ${customerCredits} Credits`
      : props.ownerMode && estimatedMaximumCostUsd !== null
        ? `Generieren · ca. ${estimatedMaximumCostUsd.toFixed(2).replace(".", ",")} $`
        : "Generieren"
    : generateReadiness.label;

  const buildSetup = useCallback((): UgcVideoGenerationSetup | null => {
    if (activeReferences.length > effectiveLimit) {
      setNotice({
        kind: "ERROR",
        text: `Für ${selectedModel.name} sind zu viele Referenzen ausgewählt.`,
      });
      return null;
    }
    if (
      activeReferences.some((reference) => reference.mediaType === "AUDIO") &&
      !activeReferences.some((reference) => reference.mediaType !== "AUDIO")
    ) {
      setNotice({
        kind: "ERROR",
        text: "Eine Audio-Referenz benötigt mindestens ein Bild oder Video.",
      });
      return null;
    }
    const parsed = ugcVideoGenerationSetupSchema.safeParse({
      contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
      mode,
      prompt,
      modelId,
      duration,
      aspectRatio,
      quality,
      bitrate,
      videoType,
      references: activeReferences.map(referenceMetadata),
      advanced,
      klingMotion,
      videoEdit,
      baseVideo: effectiveBaseVideo,
    });
    if (!parsed.success) {
      setNotice({
        kind: "ERROR",
        text: prompt.trim() || mode === "VIDEO_EDIT"
          ? "Bitte prüfe dein Video-Setup."
          : "Schreibe zuerst einen Prompt.",
      });
      return null;
    }
    if (selectedModel.id === "kling-v3-pro-motion-control") {
      try {
        assertKlingMotionReferences(parsed.data);
      } catch (error) {
        setNotice({
          kind: "ERROR",
          text:
            error instanceof KlingMotionReferenceError
              ? error.message
              : "Bitte prüfe die Kling-Referenzzuordnung.",
        });
        return null;
      }
    }
    if (mode === "VIDEO_EDIT") {
      try {
        assertUgcVideoEditSetup(parsed.data);
      } catch (error) {
        setNotice({
          kind: "ERROR",
          text: error instanceof UgcVideoEditInputError
            ? error.message
            : "Bitte prüfe Quellvideo und Model / Mockup.",
        });
        return null;
      }
    }
    return parsed.data;
  }, [
    advanced,
    activeReferences,
    aspectRatio,
    bitrate,
    duration,
    effectiveLimit,
    modelId,
    mode,
    klingMotion,
    prompt,
    quality,
    selectedModel.id,
    selectedModel.name,
    videoType,
    videoEdit,
    effectiveBaseVideo,
  ]);

  const loadSetup = useCallback((setup: UgcVideoGenerationSetup) => {
    if (setup.mode === "BASE_VIDEO" && !props.baseVideoOwnerPilot) {
      setNotice({
        kind: "ERROR",
        text: "Basisvideo erstellen ist derzeit nur im OWNER-Bereich verfügbar.",
      });
      return;
    }
    setPrompt(setup.prompt);
    setMode(setup.mode);
    setModelId(ugcVideoModelById(setup.modelId)?.id ?? setup.modelId);
    setRecommendedSelected(false);
    setDuration(setup.duration);
    setAspectRatio(setup.aspectRatio);
    setQuality(setup.quality);
    setBitrate(setup.bitrate);
    setVideoType(setup.videoType);
    setAdvanced(setup.advanced);
    setKlingMotion(setup.klingMotion);
    setVideoEdit(setup.videoEdit);
    setBaseVideo({
      ...setup.baseVideo,
      startImageReferenceId: null,
    });
    setView("CREATE");
    setNotice(
      setup.references.length
        ? {
            kind: "INFO",
            text: "Prompt und Einstellungen wurden geladen. Die ursprünglichen Referenzdateien fügst du erneut hinzu.",
          }
        : { kind: "SUCCESS", text: "Setup wurde geladen." },
    );
  }, [props.baseVideoOwnerPilot]);

  const openSave = (source?: UgcVideoGenerationSetup) => {
    setEditingPrompt(null);
    setSaveSource(source ?? null);
    setSaveOpen(true);
  };

  const savePrompt = useCallback(
    (metadata: { title: string; description: string; tags: string[] }) => {
      const setup = saveSource ?? buildSetup();
      if (!setup) return;
      const timestamp = nowIso();
      const existing = editingPrompt;
      const record: SavedUgcVideoPrompt = {
        id: existing?.id ?? createUgcVideoClientId(),
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        favorite: existing?.favorite ?? false,
        mode: setup.mode,
        prompt: setup.prompt,
        modelId: setup.modelId,
        duration: setup.duration,
        aspectRatio: setup.aspectRatio,
        quality: setup.quality,
        bitrate: setup.bitrate,
        videoType: setup.videoType,
        advanced: setup.advanced,
        klingMotion: setup.klingMotion,
        videoEdit: setup.videoEdit,
        baseVideo: setup.baseVideo,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        lastUsedAt: existing?.lastUsedAt ?? null,
      };
      persist(upsertUgcVideoPrompt(persisted, record));
      setSaveOpen(false);
      setSaveSource(null);
      setEditingPrompt(null);
      setNotice({
        kind: "SUCCESS",
        text: existing
          ? "Prompt wurde aktualisiert."
          : "Prompt wurde gespeichert.",
      });
    },
    [buildSetup, editingPrompt, persist, persisted, saveSource],
  );

  const addReferences = useCallback(
    (files: File[]) => {
      const currentBytes = references.reduce(
        (sum, reference) => sum + reference.byteLength,
        0,
      );
      const counts = references.reduce(
        (value, reference) => {
          value[reference.mediaType] += 1;
          return value;
        },
        { IMAGE: 0, VIDEO: 0, AUDIO: 0 },
      );
      let bytes = currentBytes;
      const accepted: File[] = [];
      for (const file of files) {
        const mediaType = mediaTypeFromMime(file.type);
        if (!mediaType) continue;
        const allowed = UGC_VIDEO_REFERENCE_MIME_TYPES[mediaType] as readonly string[];
        const modalityLimit =
          mediaType === "IMAGE"
            ? UGC_VIDEO_IMAGE_REFERENCE_LIMIT
            : mediaType === "VIDEO"
              ? UGC_VIDEO_VIDEO_REFERENCE_LIMIT
              : UGC_VIDEO_AUDIO_REFERENCE_LIMIT;
        if (
          !allowed.includes(file.type) ||
          file.size > UGC_VIDEO_REFERENCE_MAX_BYTES[mediaType] ||
          bytes + file.size > UGC_VIDEO_REFERENCE_TOTAL_MAX_BYTES ||
          counts[mediaType] >= modalityLimit ||
          references.length + accepted.length >= effectiveLimit
        ) {
          continue;
        }
        bytes += file.size;
        counts[mediaType] += 1;
        accepted.push(file);
      }
      const additions = accepted.map((file, index) =>
        createReference(file, references.length + index),
      );
      setReferences((current) => [...current, ...additions]);
      for (const reference of additions) {
        uploadUgcReference(reference, (id, value) =>
          setReferences((current) =>
            current.map((item) =>
              item.id === id ? { ...item, ...value } : item,
            ),
          ),
        );
      }
      if (accepted.length !== files.length) {
        setNotice({
          kind: "INFO",
          text: "Einige Dateien wurden nicht hinzugefügt. NexHQ V1 erlaubt unterstützte Medien bis insgesamt 20 MB.",
        });
      }
    },
    [effectiveLimit, references],
  );

  useEffect(() => {
    if (!props.initialLibraryAssetId || initialLibraryAssetLoadedRef.current) return;
    initialLibraryAssetLoadedRef.current = true;
    void (async () => {
      try {
        const response = await fetch(`/api/xeriano/library/${encodeURIComponent(props.initialLibraryAssetId!)}/content`, { credentials: "same-origin" });
        if (!response.ok) throw new Error("library_asset_unavailable");
        const blob = await response.blob();
        const extension = blob.type.startsWith("video/") ? "mp4" : blob.type === "image/jpeg" ? "jpg" : blob.type.split("/")[1] ?? "png";
        addReferences([new File([blob], `xeriano-reference.${extension}`, { type: blob.type })]);
        setNotice({ kind: "SUCCESS", text: "Das Asset wurde aus deiner Bibliothek als Referenz hinzugefügt." });
      } catch { setNotice({ kind: "ERROR", text: "Das Bibliotheks-Asset konnte nicht als Referenz geladen werden." }); }
    })();
  }, [addReferences, props.initialLibraryAssetId]);

  const removeReference = (id: string) => {
    const removed = references.find((reference) => reference.id === id);
    if (removed?.tempReferenceId) {
      void deleteXerianoTempReference(removed.tempReferenceId);
    }
    setReferences((current) =>
      current
        .filter((reference) => {
          if (reference.id === id) URL.revokeObjectURL(reference.previewUrl);
          return reference.id !== id;
        })
        .map((reference, order) => ({ ...reference, order })),
    );
    setVideoEdit((current) => ({
      ...current,
      sourceVideoReferenceId: current.sourceVideoReferenceId === id ? null : current.sourceVideoReferenceId,
      characterMasterReferenceId: current.characterMasterReferenceId === id ? null : current.characterMasterReferenceId,
    }));
    setBaseVideo((current) => ({
      ...current,
      startImageReferenceId:
        current.startImageReferenceId === id
          ? null
          : current.startImageReferenceId,
    }));
  };

  const clearReferences = () => {
    references.forEach((reference) => {
      URL.revokeObjectURL(reference.previewUrl);
      if (reference.tempReferenceId) {
        void deleteXerianoTempReference(reference.tempReferenceId);
      }
    });
    setReferences([]);
    setVideoEdit({ ...DEFAULT_UGC_VIDEO_EDIT_SETTINGS });
    setBaseVideo({ ...DEFAULT_UGC_BASE_VIDEO_SETTINGS });
  };

  const replaceBaseVideoReference = useCallback((file: File) => {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > UGC_VIDEO_REFERENCE_MAX_BYTES.IMAGE
    ) {
      setNotice({
        kind: "ERROR",
        text: "Dieses Startbild wird nicht unterstützt oder ist zu groß.",
      });
      return;
    }
    const previous = baseVideo.startImageReferenceId
      ? references.find(
          (reference) => reference.id === baseVideo.startImageReferenceId,
        ) ?? null
      : null;
    if (previous) {
      URL.revokeObjectURL(previous.previewUrl);
      if (previous.tempReferenceId) {
        void deleteXerianoTempReference(previous.tempReferenceId);
      }
    }
    const created = {
      ...createReference(file, references.length),
      role: "SCENE" as const,
    };
    setReferences((current) => [
      ...current.filter((reference) => reference.id !== previous?.id),
      created,
    ].map((reference, order) => ({ ...reference, order })));
    setBaseVideo((current) => ({
      ...current,
      startImageReferenceId: created.id,
      variant: "IMAGE_TO_VIDEO",
      resolution:
        selectedBaseVideoModel?.variants.IMAGE_TO_VIDEO?.resolutions.includes(
          current.resolution,
        )
          ? current.resolution
          : selectedBaseVideoModel?.variants.IMAGE_TO_VIDEO?.resolutions[0] ??
            current.resolution,
      generateAudio:
        selectedBaseVideoModel?.variants.IMAGE_TO_VIDEO?.audioSupported
          ? current.generateAudio
          : false,
    }));
    const imageAspects = selectedBaseVideoModel?.variants.IMAGE_TO_VIDEO?.aspectRatios;
    if (imageAspects?.length && !imageAspects.includes(aspectRatio)) {
      setAspectRatio(imageAspects[0]!);
    }
    uploadUgcReference(created, (id, value) =>
      setReferences((current) => current.map((reference) =>
        reference.id === id ? { ...reference, ...value } : reference,
      )),
    );
  }, [aspectRatio, baseVideo.startImageReferenceId, references, selectedBaseVideoModel]);

  const removeBaseVideoReference = () => {
    if (startImage) removeReference(startImage.id);
    const textVariant = selectedBaseVideoModel?.variants.TEXT_TO_VIDEO;
    if (textVariant) {
      setAspectRatio(
        textVariant.aspectRatios.includes("9:16")
          ? "9:16"
          : textVariant.aspectRatios[0]!,
      );
      setBaseVideo((current) => ({
        ...current,
        variant: "TEXT_TO_VIDEO",
        resolution: textVariant.resolutions.includes(current.resolution)
          ? current.resolution
          : textVariant.resolutions.includes("720p")
            ? "720p"
            : textVariant.resolutions[0]!,
        generateAudio: textVariant.audioSupported
          ? current.generateAudio
          : false,
      }));
    }
  };

  const replaceVideoEditReference = useCallback((kind: "VIDEO" | "IMAGE", file: File) => {
    const mediaType = mediaTypeFromMime(file.type);
    const allowed = UGC_VIDEO_REFERENCE_MIME_TYPES[kind] as readonly string[];
    const seedanceVideoLimit = selectedModel.id === "seedance-2-fast-video-edit" ? 50 * 1024 * 1024 : UGC_VIDEO_REFERENCE_MAX_BYTES.VIDEO;
    const maximumBytes = kind === "VIDEO" ? seedanceVideoLimit : UGC_VIDEO_REFERENCE_MAX_BYTES.IMAGE;
    if (mediaType !== kind || !allowed.includes(file.type) || file.size > maximumBytes) {
      setNotice({
        kind: "ERROR",
        text: kind === "VIDEO"
          ? "Dieses Quellvideo wird vom ausgewählten Modell nicht unterstützt oder ist zu groß."
          : "Dieses Model-/Mockup-Bild wird nicht unterstützt oder ist zu groß.",
      });
      return;
    }
    const previous = kind === "VIDEO"
      ? sourceVideo ? [sourceVideo] : []
      : characterMaster ? [characterMaster] : [];
    for (const reference of previous) {
      URL.revokeObjectURL(reference.previewUrl);
      if (reference.tempReferenceId) void deleteXerianoTempReference(reference.tempReferenceId);
    }
    const created = {
      ...createReference(file, kind === "VIDEO" ? 0 : 1),
      role: kind === "VIDEO" ? "MOTION" as const : "MODEL" as const,
    };
    const previousIds = new Set(previous.map((reference) => reference.id));
    setReferences((current) => [
      ...current.filter((reference) => !previousIds.has(reference.id)),
      created,
    ].sort((left, right) => left.mediaType === "VIDEO" ? -1 : right.mediaType === "VIDEO" ? 1 : left.order - right.order).map((reference, order) => ({ ...reference, order })));
    setVideoEdit((current) => ({
      ...current,
      ...(kind === "VIDEO"
        ? { sourceVideoReferenceId: created.id }
        : { characterMasterReferenceId: created.id }),
    }));
    uploadUgcReference(created, (id, value) =>
      setReferences((current) => current.map((reference) => reference.id === id ? { ...reference, ...value } : reference)),
    );
  }, [characterMaster, selectedModel.id, sourceVideo]);

  const generate = useCallback(async () => {
    if (generationLockRef.current) return;
    if (activeRun?.status === "RUNNING") {
      setView("CREATE");
      setNotice({
        kind: "INFO",
        text: "Dieses Video wird bereits erstellt. Es wurde kein neuer Auftrag gestartet.",
      });
      return;
    }
    const setup = buildSetup();
    if (!setup) return;
    if (activeReferences.some((reference) => reference.uploadState !== "READY")) {
      setNotice({
        kind: "ERROR",
        text: activeReferences.some((reference) => reference.uploadState === "FAILED")
          ? "Upload fehlgeschlagen. Bitte entferne die Referenz und versuche es erneut."
          : "Referenz wird hochgeladen …",
      });
      return;
    }
    const model = ugcVideoModelById(setup.modelId);
    if (model?.availability !== "LIVE") {
      const timestamp = nowIso();
      const run: UgcVideoRun = {
        id: createUgcVideoClientId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        status: "PROVIDER_NOT_CONNECTED",
        setup,
        results: [],
        message: `${model?.name ?? "Dieses Modell"} ist noch nicht live verbunden. Es wurde kein kostenpflichtiger Aufruf ausgeführt.`,
      };
      persist(upsertUgcVideoRun(persisted, run));
      setActiveRun(run);
      setNotice({ kind: "INFO", text: run.message! });
      return;
    }
    if (props.customerMode && customerModelUnavailable) {
      setNotice({
        kind: "ERROR",
        text:
          selectedModel.id === "seedance-2.5"
            ? "Seedance 2.5 ist für Kunden noch nicht bepreist."
            : `${selectedModel.name} ist für Kunden gerade nicht verfügbar.`,
      });
      return;
    }
    if (props.customerMode && customerCredits === null) {
      setNotice({
        kind: "ERROR",
        text: "Die Dauer des Bewegungs-Referenzvideos konnte noch nicht bestimmt werden.",
      });
      return;
    }
    if (!klingDurationAllowed) {
      setNotice({
        kind: "ERROR",
        text: "Das Bewegungs-Referenzvideo ist kürzer als die gewählte Videolänge.",
      });
      return;
    }
    if (props.customerMode && insufficientCustomerCredits) {
      setNotice({ kind: "ERROR", text: "Nicht genügend Credits." });
      return;
    }
    if (props.customerMode && customerConcurrencyReached) {
      setNotice({
        kind: "ERROR",
        text: "Du hast bereits die maximale Anzahl gleichzeitiger Videogenerierungen erreicht.",
      });
      return;
    }
    if (
      !props.customerMode &&
      !(mode === "BASE_VIDEO"
        ? props.baseVideoOwnerPilot &&
          props.providerConfig?.baseVideoOwnerPilot.ready
        : props.ownerMode
          ? selectedProviderConfig?.ownerReady
          : selectedProviderConfig?.ready)
    ) {
      setNotice({
        kind: "ERROR",
        text: !props.ownerMode && !selectedProviderConfig?.costCapConfigured
          ? "Das Kostenlimit für dieses Modell ist noch nicht eingerichtet."
          : `${selectedModel.name} ist serverseitig noch nicht vollständig eingerichtet.`,
        details: [
          !(mode === "BASE_VIDEO"
            ? props.providerConfig?.baseVideoOwnerPilot.credentialConfigured
            : selectedProviderConfig?.credentialConfigured) ? "FAL_KEY fehlt." : null,
          !props.ownerMode && !selectedProviderConfig?.costCapConfigured
            ? "Das modellspezifische Kostenlimit fehlt oder ist ungültig."
            : null,
          !(mode === "BASE_VIDEO"
            ? props.providerConfig?.baseVideoOwnerPilot.storageConfigured
            : selectedProviderConfig?.storageConfigured)
            ? "Private NexHQ-Speicherung ist nicht konfiguriert."
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
      return;
    }
    if (
      !props.customerMode &&
      !props.ownerMode &&
      (estimatedMaximumCostUsd === null ||
        selectedProviderConfig?.costCapUsd === null ||
        selectedProviderConfig?.costCapUsd === undefined ||
        estimatedMaximumCostUsd > selectedProviderConfig.costCapUsd)
    ) {
      setNotice({
        kind: "ERROR",
        text: "Das gewählte Setup überschreitet das eingerichtete Kostenlimit.",
      });
      return;
    }

    generationLockRef.current = true;
    setGenerating(true);
    setNotice(null);
    const timestamp = nowIso();
    const jobId = createUgcVideoClientId();
    const provisional: UgcVideoRun = {
      id: jobId,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: "RUNNING",
      setup,
      results: [],
      message: "Video wird erstellt …",
      provider: "fal",
      providerModel: props.customerMode
        ? selectedCustomerModelConfig?.displayName
        : selectedProviderConfig?.providerModel,
      providerRequestId: null,
      ...(props.customerMode
        ? {}
        : { estimatedMaximumCostUsd, actualCostUsd: null }),
    };
    persist(upsertUgcVideoRun(persisted, provisional));
    setActiveRun(provisional);
    try {
      const run = await submitUgcVideoGeneration({
        jobId,
        setup,
        references: activeReferences,
        ...(props.customerMode
          ? { onCredit: (receipt) => setAvailableCredits(receipt.availableCredits) }
          : {}),
      });
      persist(
        upsertUgcVideoRun(loadUgcVideoState(window.localStorage), run),
      );
      setActiveRun(run);
      setNotice(
        run.status === "RUNNING"
          ? null
          : {
              kind: run.status === "SUCCEEDED" ? "SUCCESS" : "ERROR",
              text: run.message ?? "Der Videoauftrag wurde abgeschlossen.",
            },
      );
    } catch (error) {
      const preflight =
        error instanceof UgcVideoGenerationClientError &&
        [
          "AUTHENTICATION_REQUIRED",
          "INVALID_REQUEST",
          "REFERENCE_LIMIT_EXCEEDED",
          "REFERENCE_INVALID",
          "PROVIDER_NOT_CONFIGURED",
          "UGC_VIDEO_COST_CAP_NOT_CONFIGURED",
          "UGC_VIDEO_STORAGE_SETUP_FAILED",
          "IDEMPOTENCY_CONFLICT",
          "INSUFFICIENT_CREDITS",
          "CONCURRENCY_LIMIT_REACHED",
          "CUSTOMER_MODEL_UNAVAILABLE",
          "VIDEO_DURATION_REQUIRED",
          "VIDEO_DURATION_INVALID",
          "ACCOUNT_NOT_ACTIVE",
          "XERIANO_CREDIT_AUTHORITY_UNAVAILABLE",
          "GENERATION_ALREADY_STARTED",
          "CUSTOMER_ACCOUNT_REQUIRED",
          "BASE_VIDEO_OWNER_ONLY",
          "BASE_VIDEO_MODEL_UNAVAILABLE",
          "BASE_VIDEO_PROMPT_REQUIRED",
          "BASE_VIDEO_PROMPT_TOO_LONG",
          "BASE_VIDEO_START_IMAGE_REQUIRED",
          "BASE_VIDEO_START_IMAGE_UNSUPPORTED",
          "BASE_VIDEO_DURATION_UNSUPPORTED",
          "BASE_VIDEO_ASPECT_UNSUPPORTED",
          "BASE_VIDEO_RESOLUTION_UNSUPPORTED",
          "BASE_VIDEO_AUDIO_UNSUPPORTED",
        ].includes(error.code);
      const storageSetupFailed =
        error instanceof UgcVideoGenerationClientError &&
        error.code === "UGC_VIDEO_STORAGE_SETUP_FAILED";
      const failed: UgcVideoRun = {
        ...provisional,
        updatedAt: nowIso(),
        status: preflight ? "FAILED" : "UNKNOWN_OUTCOME",
        message:
          storageSetupFailed
            ? `${error.message} Die Videoerstellung wurde nicht gestartet. Es sind keine Providerkosten entstanden.`
            : preflight && error instanceof UgcVideoGenerationClientError
            ? error.message
            : "Der Anbieterstatus ist unklar. Es wird kein neuer Auftrag gestartet.",
      };
      persist(
        upsertUgcVideoRun(loadUgcVideoState(window.localStorage), failed),
      );
      setActiveRun(failed);
      setNotice({
        kind: "ERROR",
        text: failed.message!,
        ...(error instanceof UgcVideoGenerationClientError &&
        error.technicalDetails
          ? { details: error.technicalDetails }
          : {}),
      });
    } finally {
      generationLockRef.current = false;
      setGenerating(false);
    }
  }, [
    activeRun?.status,
    buildSetup,
    estimatedMaximumCostUsd,
    persist,
    persisted,
    selectedModel.id,
    selectedModel.name,
    selectedProviderConfig,
    selectedCustomerModelConfig,
    activeReferences,
    mode,
    props.customerMode,
    props.ownerMode,
    props.baseVideoOwnerPilot,
    props.providerConfig?.baseVideoOwnerPilot,
    customerModelUnavailable,
    customerCredits,
    insufficientCustomerCredits,
    customerConcurrencyReached,
    klingDurationAllowed,
  ]);

  const addResultAsReference = useCallback(
    async (result: UgcVideoResult) => {
      try {
        const response = await fetch(result.url, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`download_${response.status}`);
        const blob = await response.blob();
        const file = new File(
          [blob],
          `ugc-video-ergebnis-${references.length + 1}.mp4`,
          { type: blob.type || "video/mp4" },
        );
        addReferences([file]);
        setNotice({
          kind: "SUCCESS",
          text: "Das Ergebnis wurde als Video-Referenz hinzugefügt.",
        });
      } catch {
        setNotice({
          kind: "ERROR",
          text: "Das Ergebnis konnte nicht als Referenz übernommen werden.",
        });
      }
    },
    [addReferences, references.length],
  );

  const changeMode = (nextMode: UgcVideoMode) => {
    if (nextMode === "BASE_VIDEO" && !props.baseVideoOwnerPilot) return;
    setMode(nextMode);
    if (nextMode === "VIDEO_EDIT") {
      const recommended = props.customerConfig?.recommendedVideoEditModelId ??
        props.providerConfig?.recommendedVideoEditModelId ??
        RECOMMENDED_VIDEO_EDIT_MODEL_ID;
      setModelId(recommended);
      setRecommendedSelected(true);
      setDuration("5");
      setAspectRatio("AUTO");
      setQuality("720p");
      setBitrate("STANDARD");
      setAdvanced((current) => ({ ...current, generateAudio: false }));
      const videos = references.filter((reference) => reference.mediaType === "VIDEO");
      const images = references.filter((reference) => reference.mediaType === "IMAGE");
      const preferredVideo = videos.filter((reference) => reference.role === "MOTION");
      const preferredImage = images.filter((reference) => ["MODEL", "OUTFIT", "DESIGN"].includes(reference.role));
      setVideoEdit((current) => ({
        ...current,
        sourceVideoReferenceId: current.sourceVideoReferenceId ?? (preferredVideo.length === 1 ? preferredVideo[0]!.id : videos.length === 1 ? videos[0]!.id : null),
        characterMasterReferenceId: current.characterMasterReferenceId ?? (preferredImage.length === 1 ? preferredImage[0]!.id : images.length === 1 ? images[0]!.id : null),
      }));
    } else if (nextMode === "BASE_VIDEO") {
      const baseModel = baseVideoClientModel(DEFAULT_BASE_VIDEO_MODEL_ID)!;
      const image = baseVideo.startImageReferenceId
        ? references.find(
            (reference) => reference.id === baseVideo.startImageReferenceId,
          ) ?? null
        : null;
      const variant = image && baseModel.supportsImageToVideo
        ? "IMAGE_TO_VIDEO" as const
        : "TEXT_TO_VIDEO" as const;
      const settings = baseModel.variants[variant]!;
      setModelId(baseModel.id);
      setRecommendedSelected(false);
      setDuration("5");
      setAspectRatio(settings.aspectRatios.includes("9:16") ? "9:16" : settings.aspectRatios[0]!);
      setQuality("720p");
      setBitrate("STANDARD");
      setBaseVideo((current) => ({
        ...current,
        variant,
        resolution: settings.resolutions.includes("720p") ? "720p" : settings.resolutions[0]!,
        generateAudio: false,
      }));
    } else {
      setModelId("kling-v3-pro-motion-control");
      setRecommendedSelected(false);
      if (!["5", "10", "15", "20", "30"].includes(duration)) setDuration("5");
      setAspectRatio("9:16");
    }
  };

  const changeModel = (nextId: string) => {
    const resolvedId = nextId === AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID
      ? props.customerConfig?.recommendedVideoEditModelId ?? props.providerConfig?.recommendedVideoEditModelId ?? RECOMMENDED_VIDEO_EDIT_MODEL_ID
      : nextId;
    const model = ugcVideoModelById(resolvedId);
    if (!model) return;
    setModelId(resolvedId);
    setRecommendedSelected(nextId === AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID);
    const nextBaseModel = baseVideoClientModel(resolvedId);
    if (mode === "BASE_VIDEO" && nextBaseModel) {
      const variant = startImage && nextBaseModel.supportsImageToVideo
        ? "IMAGE_TO_VIDEO" as const
        : nextBaseModel.supportsTextToVideo
          ? "TEXT_TO_VIDEO" as const
          : "IMAGE_TO_VIDEO" as const;
      const settings = nextBaseModel.variants[variant]!;
      if (!nextBaseModel.supportedDurations.includes(duration)) {
        setDuration(nextBaseModel.supportedDurations[0]!);
      }
      setAspectRatio(settings.aspectRatios.includes(aspectRatio) ? aspectRatio : settings.aspectRatios.includes("9:16") ? "9:16" : settings.aspectRatios[0]!);
      setBaseVideo((current) => ({
        ...current,
        variant,
        resolution: settings.resolutions.includes(current.resolution)
          ? current.resolution
          : settings.resolutions.includes("720p")
            ? "720p"
            : settings.resolutions[0]!,
        generateAudio: settings.audioSupported ? current.generateAudio : false,
      }));
      observeActiveRunNowRef.current();
      return;
    }
    if (
      model.supportedDurations.length &&
      !model.supportedDurations.includes(duration)
    )
      setDuration(model.supportedDurations[0]!);
    if (
      model.supportedAspectRatios.length &&
      !model.supportedAspectRatios.includes(aspectRatio)
    )
      setAspectRatio(model.supportedAspectRatios[0]!);
    if (
      model.supportedQualities.length &&
      !model.supportedQualities.includes(quality)
    )
      setQuality(model.supportedQualities[0]!);
    if (
      model.supportedBitrates.length &&
      !model.supportedBitrates.includes(bitrate)
    )
      setBitrate(model.supportedBitrates[0]!);
    // If a previous accepted job completed between polls, do not make model
    // switching wait for the next interval before its truthful CTA can update.
    observeActiveRunNowRef.current();
  };

  const toggleResultFavorite = (result: UgcVideoResult) => {
    if (!activeRun) return;
    const next = {
      ...activeRun,
      results: activeRun.results.map((item) =>
        item.id === result.id ? { ...item, favorite: !item.favorite } : item,
      ),
      updatedAt: nowIso(),
    };
    setActiveRun(next);
    persist(upsertUgcVideoRun(persisted, next));
  };

  const saveResultToLibrary = useCallback(async (resultId: string) => {
    if (!activeRun) return;
    try {
      const response = await fetch("/api/xeriano/library/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "xeriano-result-library-import-v1",
          sourceStudio: "UGC_VIDEO_STUDIO",
          sourceJobId: activeRun.id,
          sourceResultId: resultId,
          title: `UGC Video · ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activeRun.createdAt))}`,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "library_import_failed");
      setNotice({ kind: "SUCCESS", text: "Das Video wurde in deiner Bibliothek gespeichert." });
    } catch (error) {
      setNotice({
        kind: "ERROR",
        text: error instanceof Error && error.message !== "library_import_failed"
          ? error.message
          : "Das Video konnte nicht in der Bibliothek gespeichert werden.",
      });
    }
  }, [activeRun]);

  return (
    <main className={`ugc-video-studio-shell${props.ownerMode ? " is-owner-product-mode" : ""}`}>
      <header className="uv-topbar">
        <div className="uv-brand"><span><Video size={19} /></span><div><strong>UGC Video Studio</strong><small>Flexible UGC-Videos mit Referenzen und Prompt</small></div></div>
        <nav aria-label="UGC Video Studio Bereiche">
          <button type="button" className={view === "CREATE" ? "is-active" : ""} onClick={() => setView("CREATE")}><Sparkles size={15} /> Erstellen</button>
          <button type="button" className={view === "PROMPTS" ? "is-active" : ""} onClick={() => setView("PROMPTS")}><Bookmark size={15} /> Prompt-Bibliothek</button>
          <button type="button" className={view === "HISTORY" ? "is-active" : ""} onClick={() => setView("HISTORY")}><History size={15} /> Verlauf</button>
        </nav>
        <button type="button" className="uv-save-top" disabled={!prompt.trim()} onClick={() => openSave()}><Save size={15} /><span>Prompt speichern</span></button>
      </header>

      {view === "CREATE" ? (
        <div className="uv-create-view">
          <section className="uv-hero"><div><span>Referenzgesteuerte Videoerstellung</span><h1>UGC, das sich echt anfühlt.</h1><p>Referenzen hinzufügen, frei beschreiben und mit wenigen Einstellungen generieren.</p></div><span>{selectedModel.name} · fal</span></section>

          {productMode ? <UgcModeSelector mode={mode} onChange={changeMode} baseVideoEnabled={Boolean(props.baseVideoOwnerPilot)} /> : null}

          <div className="uv-workspace">
            <div className="uv-main-column">
              {mode === "VIDEO_EDIT" ? <UgcVideoEditUploader
                sourceVideo={sourceVideo}
                characterMaster={characterMaster}
                onSelect={replaceVideoEditReference}
                onRemove={removeReference}
                onDuration={(id, seconds) => setReferences((current) => current.map((reference) => reference.id === id ? { ...reference, durationSeconds: seconds } : reference))}
              /> : mode === "BASE_VIDEO" ? <UgcBaseVideoUploader
                startImage={startImage}
                imageSupported={Boolean(selectedBaseVideoModel?.supportsImageToVideo)}
                imageRequired={Boolean(selectedBaseVideoModel && !selectedBaseVideoModel.supportsTextToVideo)}
                variant={baseVideoVariant}
                onSelect={replaceBaseVideoReference}
                onRemove={removeBaseVideoReference}
              /> : <UgcReferenceUploader
                references={references}
                effectiveLimit={effectiveLimit}
                onAdd={addReferences}
                onRemove={removeReference}
                onClear={clearReferences}
                onRoleChange={(id: string, role: UgcVideoReferenceRole) => setReferences((current) => current.map((reference) => reference.id === id ? { ...reference, role } : reference))}
                onDuration={(id, seconds) => setReferences((current) => current.map((reference) => reference.id === id ? { ...reference, durationSeconds: seconds } : reference))}
              />}

              <section className="uv-card uv-prompt-card">
                <div className="uv-section-heading"><div><span>02</span><div><h2>{mode === "VIDEO_EDIT" ? "Was soll geändert werden?" : "Prompt"}</h2><p>{mode === "VIDEO_EDIT" ? "Optional – Xeriamo ersetzt die Hauptperson bereits automatisch." : mode === "BASE_VIDEO" ? "Beschreibe ein originales Fashion-Basisvideo." : "Szene, Kamera, Bewegung und Stimmung frei beschreiben."}</p></div></div><button type="button" className="uv-prompt-save" disabled={!prompt.trim()} onClick={() => openSave()}><Save size={14} /> Prompt speichern</button></div>
                <textarea value={prompt} maxLength={12000} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === "VIDEO_EDIT" ? "Optional: z. B. Bewahre den Oversized Fit und den Frontprint besonders stark." : mode === "BASE_VIDEO" ? "z. B. Eine erwachsene Person geht in einer modernen U-Bahn-Station eine Rolltreppe hinab, Ganzkörper, eine ruhige durchgehende Aufnahme …" : "Beschreibe dein UGC-Video, die Szene, Kamera, Bewegung und gewünschte Stimmung …"} />
                <div className="uv-prompt-meta"><span>{mode === "BASE_VIDEO" && modelId === "pixverse-c1-base" ? `${new TextEncoder().encode(prompt).byteLength.toLocaleString("de-DE")} / 2.048 Bytes` : `${prompt.length.toLocaleString("de-DE")} / 12.000`}</span><button type="button" disabled={!prompt} onClick={() => setPrompt("")}>Leeren</button></div>
                {mode === "MOTION_CONTROL" ? <><div className="uv-prompt-tags" aria-label="Prompt-Ideen">{QUICK_TAGS.map((tag) => <button type="button" key={tag} onClick={() => setPrompt((current) => `${current}${current.trim() ? ", " : ""}${tag}`)}>{tag}</button>)}</div>
                <div className="uv-video-types"><span>Video-Typ</span><div>{UGC_VIDEO_TYPES.map((type) => <button type="button" key={type} className={videoType === type ? "is-active" : ""} onClick={() => setVideoType(type)}>{UGC_VIDEO_TYPE_LABELS[type]}</button>)}</div></div></> : null}
              </section>

              <section className="uv-card uv-settings-card">
                <div className="uv-section-heading uv-section-heading--compact"><div><span>03</span><div><h2>Videoeinstellungen</h2><p>Schnell wählen und weiter.</p></div></div></div>
                {mode === "VIDEO_EDIT" ? (
                  <UgcVideoEditSettings
                    duration={duration}
                    supportedDurations={selectedModel.supportedDurations}
                    sourceDurationSeconds={selectedSourceSeconds}
                    keepOriginalSoundSupported={selectedModel.characterReferenceStrategy === "KLING_ELEMENT"}
                    settings={videoEdit}
                    onDuration={setDuration}
                    onChange={setVideoEdit}
                  />
                ) : mode === "BASE_VIDEO" && selectedBaseVideoModel && selectedBaseVideoVariant ? (
                  <UgcBaseVideoSettings
                    duration={duration}
                    aspectRatio={aspectRatio}
                    settings={effectiveBaseVideo}
                    supportedDurations={selectedBaseVideoModel.supportedDurations}
                    supportedAspectRatios={selectedBaseVideoVariant.aspectRatios}
                    supportedResolutions={selectedBaseVideoVariant.resolutions}
                    audioSupported={selectedBaseVideoVariant.audioSupported}
                    onDuration={setDuration}
                    onAspectRatio={setAspectRatio}
                    onChange={setBaseVideo}
                  />
                ) : selectedModel.settingsKind === "KLING_MOTION_CONTROL" ? (
                  <>
                    <UgcKlingMotionControls
                      references={references}
                      settings={klingMotion}
                      onChange={setKlingMotion}
                    />
                    <UgcKlingDurationSelector
                      duration={duration}
                      characterOrientation={klingMotion.characterOrientation}
                      sourceDurationSeconds={selectedMotionSourceSeconds}
                      onChange={setDuration}
                    />
                  </>
                ) : (
                  <UgcQuickControls
                    setup={{ duration, aspectRatio, quality, bitrate }}
                    model={selectedModel}
                    onDuration={setDuration}
                    onAspectRatio={setAspectRatio}
                    onQuality={setQuality}
                    onBitrate={setBitrate}
                  />
                )}
                <div className="uv-cost"><div><span>{props.customerMode?"Credit-Preis":"Geschätzte Kosten"}</span><strong>{props.customerMode?(customerCredits!==null?`${customerCredits} Credits`:selectedModel.settingsKind === "KLING_MOTION_CONTROL"||mode === "VIDEO_EDIT"?"Videolänge wählen":"Für Kunden nicht verfügbar"):estimatedMaximumCostUsd === null ? "Nicht verfügbar" : `ca. ${estimatedMaximumCostUsd.toFixed(2).replace(".", ",")} $`}</strong></div><p>{props.customerMode?`${availableCredits.toLocaleString("de-DE")} Credits verfügbar.`:mode === "BASE_VIDEO" ? `${baseVideoVariant === "IMAGE_TO_VIDEO" ? "Startbild zu Video" : "Text zu Video"} · ${duration} Sekunden.` : mode === "VIDEO_EDIT"||selectedModel.settingsKind === "KLING_MOTION_CONTROL"?`Für ${duration} Sekunden Ausgabe.`:references.some((reference) => reference.mediaType === "VIDEO")?"Schätzung inklusive Video-Referenz.":"Schätzung für Dauer, Format und Qualität."}</p>{!productMode&&props.providerConfig?<p>V1-Speicherlimit: {Math.round(props.providerConfig.resultStorageLimitBytes / 1024 / 1024)} MB pro Ergebnis.</p>:null}</div>
              </section>
            </div>

            <aside className="uv-side-column">
              <UgcModelSelector modelId={modelId} mode={mode} recommendedModelId={props.customerConfig?.recommendedVideoEditModelId ?? props.providerConfig?.recommendedVideoEditModelId} recommendedSelected={recommendedSelected} open={modelOpen} onOpen={() => setModelOpen(true)} onClose={() => setModelOpen(false)} onChange={changeModel} customerMode={props.customerMode} />
              {selectedModel.settingsKind === "SEEDANCE" ? <UgcAdvancedPanel open={advancedOpen} advanced={advanced} onToggle={() => setAdvancedOpen((value) => !value)} onChange={setAdvanced} /> : null}
            </aside>
          </div>

          {notice ? <div className={`uv-notice is-${notice.kind.toLowerCase()}`} role={notice.kind === "ERROR" ? "alert" : "status"}><span>{notice.kind === "SUCCESS" ? <CheckCircle2 size={17} /> : notice.kind === "ERROR" ? <X size={17} /> : <Sparkles size={17} />}</span><div><strong>{notice.text}</strong>{notice.details ? <details><summary>Details</summary><p>{notice.details}</p></details> : null}</div><button type="button" onClick={() => setNotice(null)} aria-label="Meldung schließen"><X size={15} /></button></div> : null}

          <section className="uv-results" aria-labelledby="uv-results-title">
            <header><div><span>Ausgabe</span><h2 id="uv-results-title">Ergebnisse</h2></div>{activeRun?.status === "SUCCEEDED" ? <button type="button" onClick={() => openSave(activeRun.setup)}><Save size={15} /> Prompt speichern</button> : null}</header>
            {activeRun?.status === "RUNNING" ? (
              <div className="uv-result-empty"><Loader2 className="is-spinning" size={30} /><h3>Video wird erstellt …</h3><p>Der Auftrag wurde einmal übermittelt. Bitte nicht erneut senden.</p></div>
            ) : activeRun?.results.length ? (
              <div className="uv-result-grid">{activeRun.results.map((result) => (
                <article className="uv-result-card" key={result.id}>
                  <UgcResultVideo result={result} />
                  <div><strong>{activeRun.setup.mode === "VIDEO_EDIT" || activeRun.setup.mode === "BASE_VIDEO" ? ugcVideoModelById(activeRun.setup.modelId)?.name ?? activeRun.setup.modelId : UGC_VIDEO_TYPE_LABELS[activeRun.setup.videoType]}</strong><span>{activeRun.setup.mode === "BASE_VIDEO" ? `Basisvideo · ${activeRun.setup.baseVideo.variant === "IMAGE_TO_VIDEO" ? "Startbild zu Video" : "Text zu Video"} · ${activeRun.setup.duration}s` : activeRun.setup.modelId === "kling-v3-pro-motion-control" ? `${activeRun.setup.klingMotion.characterOrientation === "VIDEO" ? "Bewegung folgen" : "Bild folgen"}${activeRun.setup.klingMotion.keepOriginalSound ? " · Originalton" : ""}` : `${activeRun.setup.duration}s · ${activeRun.setup.quality}`}</span></div>
                  <footer>
                    <a href={result.downloadUrl}><Download size={15} /> Herunterladen</a>
                    <button type="button" onClick={() => setLargeResult(result)}><Maximize2 size={15} /> Vergrößern</button>
                    <button type="button" onClick={() => addResultAsReference(result)}><PlusReferenceIcon /> Als Referenz</button>
                    {productMode ? <button type="button" onClick={() => void saveResultToLibrary(result.id)}><Bookmark size={15} /> In Bibliothek speichern</button> : null}
                    <button type="button" onClick={() => toggleResultFavorite(result)} aria-label="Favorit"><Heart size={15} fill={result.favorite ? "currentColor" : "none"} /></button>
                    <button type="button" onClick={() => { void copyUgcPromptText(activeRun.setup.prompt).then((copied) => setNotice({ kind: copied ? "SUCCESS" : "ERROR", text: copied ? "Prompt wurde kopiert." : "Prompt konnte nicht kopiert werden." })); }}><Clipboard size={15} /> Prompt kopieren</button>
                    <button type="button" onClick={() => loadSetup(activeRun.setup)}><RotateCcw size={15} /> Neu erstellen</button>
                  </footer>
                </article>
              ))}</div>
            ) : activeRun?.status === "FAILED" || activeRun?.status === "UNKNOWN_OUTCOME" ? (
              <div className="uv-result-empty uv-result-empty--failed">
                <X size={29} />
                <h3>{activeRun.status === "FAILED" ? "Das Video konnte nicht erstellt werden." : activeRun.message ?? "Der Anbieterstatus ist unklar."}</h3>
                <p>{activeRun.status === "FAILED" ? "Unter Details findest du die bereinigte Anbieter-Meldung, sofern sie verfügbar ist." : "Der angenommene Auftrag wird nicht erneut gesendet."}</p>
                <UgcProviderDetails run={activeRun} />
              </div>
            ) : (
              <div className="uv-result-empty"><Play size={29} /><h3>Bereit für dein erstes Video</h3><p>Hier erscheint dein dauerhaft gespeichertes Ergebnis. Es werden keine Beispielvideos erfunden.</p></div>
            )}
          </section>

          {!modelOpen ? <div className="uv-generate-bar"><button type="button" className="uv-generate" data-readiness={generateReadiness.code} disabled={!generateReadiness.ready} onClick={generate}>{generating || activeRun?.status === "RUNNING" ? <Loader2 className="is-spinning" size={19} /> : <Sparkles size={19} />} {generateLabel}</button></div> : null}
        </div>
      ) : view === "PROMPTS" ? (
        <UgcPromptLibrary
          prompts={persisted.prompts}
          onLoad={(saved) => {
            const setup = ugcVideoGenerationSetupSchema.parse({
              contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
              mode: saved.mode,
              prompt: saved.prompt,
              modelId: saved.modelId,
              duration: saved.duration,
              aspectRatio: saved.aspectRatio,
              quality: saved.quality,
              bitrate: saved.bitrate,
              videoType: saved.videoType,
              references: [],
              advanced: saved.advanced,
              klingMotion: saved.klingMotion,
              videoEdit: saved.videoEdit,
              baseVideo: saved.baseVideo,
            });
            loadSetup(setup);
            persist(upsertUgcVideoPrompt(persisted, { ...saved, lastUsedAt: nowIso() }));
          }}
          onEdit={(saved) => { setEditingPrompt(saved); setSaveSource(ugcVideoGenerationSetupSchema.parse({ contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION, mode: saved.mode, prompt: saved.prompt, modelId: saved.modelId, duration: saved.duration, aspectRatio: saved.aspectRatio, quality: saved.quality, bitrate: saved.bitrate, videoType: saved.videoType, references: [], advanced: saved.advanced, klingMotion: saved.klingMotion, videoEdit: saved.videoEdit, baseVideo: saved.baseVideo })); setSaveOpen(true); }}
          onCopy={(saved) => copyUgcPromptText(saved.prompt)}
          onFavorite={(saved) => persist(upsertUgcVideoPrompt(persisted, { ...saved, favorite: !saved.favorite, updatedAt: nowIso() }))}
          onDelete={(id) => persist(removeUgcVideoPrompt(persisted, id))}
        />
      ) : (
        <UgcRunHistory
          runs={persisted.runs}
          onLoadSetup={loadSetup}
          onSavePrompt={openSave}
          onOpen={(run) => {
            setActiveRun(run);
            setView("CREATE");
            window.setTimeout(() => document.getElementById("uv-results-title")?.scrollIntoView({ behavior: "smooth" }), 0);
            if (run.status === "SUCCEEDED") {
              void fetchUgcVideoJob({
                jobId: run.id,
                ...(props.customerMode
                  ? { onCredit: (receipt) => setAvailableCredits(receipt.availableCredits) }
                  : {}),
              }).then((fresh) => {
                persist(upsertUgcVideoRun(loadUgcVideoState(window.localStorage), fresh));
                setActiveRun(fresh);
              }).catch(() => undefined);
            }
          }}
        />
      )}

      <UgcPromptSaveDialog open={saveOpen} editing={editingPrompt} onClose={() => { setSaveOpen(false); setSaveSource(null); setEditingPrompt(null); }} onSave={savePrompt} />
      {largeResult ? <div className="uv-video-modal" role="presentation" onPointerDown={() => setLargeResult(null)}><section role="dialog" aria-modal="true" aria-label="Video vergrößern" onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setLargeResult(null)} aria-label="Schließen"><X size={19} /></button><UgcResultVideo result={largeResult} autoPlay /></section></div> : null}
    </main>
  );
}

function PlusReferenceIcon() {
  return <Video size={15} />;
}
