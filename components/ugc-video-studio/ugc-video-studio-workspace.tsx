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
import { useCallback, useEffect, useRef, useState } from "react";

import {
  UgcAdvancedPanel,
  UgcKlingDurationSelector,
  UgcKlingMotionControls,
  UgcModelSelector,
  UgcPromptSaveDialog,
  UgcQuickControls,
  UgcReferenceUploader,
} from "@/components/ugc-video-studio/ugc-video-studio-controls";
import {
  UgcProviderDetails,
  UgcPromptLibrary,
  UgcRunHistory,
} from "@/components/ugc-video-studio/ugc-video-studio-library";
import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
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
} from "@/lib/ugc-video-studio/contracts";
import {
  fetchUgcVideoJob,
  submitUgcVideoGeneration,
  UgcVideoGenerationClientError,
} from "@/lib/ugc-video-studio/client";
import { createUgcVideoClientId } from "@/lib/ugc-video-studio/client-id";
import {
  DEFAULT_UGC_VIDEO_MODEL_ID,
  UGC_VIDEO_MODEL_REGISTRY,
  ugcVideoModelById,
} from "@/lib/ugc-video-studio/model-registry";
import {
  loadUgcVideoState,
  removeUgcVideoPrompt,
  saveUgcVideoState,
  upsertUgcVideoPrompt,
  upsertUgcVideoRun,
} from "@/lib/ugc-video-studio/persistence";
import {
  assertKlingMotionReferences,
  KlingMotionReferenceError,
  resolveKlingMotionReferences,
} from "@/lib/ugc-video-studio/kling-motion-config";
import type { UgcVideoProviderPublicConfig } from "@/lib/ugc-video-studio/provider-config";
import type { XerianoUgcCustomerConfig } from "@/lib/xeriano/customer-config";
import type { XerianoCustomerStudioStatus } from "@/lib/xeriano/client-contracts";
import { quoteXerianoCredits } from "@/lib/xeriano/pricing";

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
  const { file: _file, previewUrl: _previewUrl, ...metadata } = reference;
  void _file;
  void _previewUrl;
  return metadata;
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
  };
}

export function UgcVideoStudioWorkspace(props: {
  providerConfig?: UgcVideoProviderPublicConfig;
  customerConfig?: XerianoUgcCustomerConfig;
  customerStatus?: XerianoCustomerStudioStatus;
  customerMode?: boolean;
  ownerMode?: boolean;
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
  const [modelId, setModelId] = useState<string>(
    props.initialModelId ?? DEFAULT_UGC_VIDEO_MODEL_ID,
  );
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
  referencesRef.current = references;

  useEffect(() => {
    const restored = loadUgcVideoState(window.localStorage);
    setPersisted(restored);
    setActiveRun(
      restored.runs.find((run) => run.status === "RUNNING") ??
        restored.runs[0] ??
        null,
    );
    return () => {
      referencesRef.current.forEach((reference) =>
        URL.revokeObjectURL(reference.previewUrl),
      );
    };
  }, []);

  const persist = useCallback((next: UgcVideoPersistedState) => {
    const saved = saveUgcVideoState(window.localStorage, next);
    setPersisted(saved);
  }, []);

  useEffect(() => {
    if (activeRun?.status !== "RUNNING") return;
    let cancelled = false;
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
    const first = window.setTimeout(poll, 3_000);
    const interval = window.setInterval(poll, 3_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeRun?.id, activeRun?.providerRequestId, activeRun?.status, persist, props.customerMode]);

  const selectedModel =
    ugcVideoModelById(modelId) ?? UGC_VIDEO_MODEL_REGISTRY[0]!;
  const effectiveLimit = selectedModel.maximumReferences;
  const selectedProviderConfig =
    selectedModel.id === "seedance-2.5" ||
    selectedModel.id === "kling-v3-pro-motion-control"
      ? props.providerConfig?.models[selectedModel.id] ?? null
      : null;
  const klingResolution = resolveKlingMotionReferences({
    references: references.map(referenceMetadata),
    klingMotion,
  });
  const ownerSeedanceEstimateKey = `${quality}|${aspectRatio}|${duration}|${references.some((reference) => reference.mediaType === "VIDEO") ? "video" : "image"}`;
  const selectedKlingSeconds = Number(duration);
  const selectedMotionSourceSeconds =
    klingResolution.motionVideo?.durationSeconds ?? null;
  const klingDurationAllowed =
    selectedModel.id !== "kling-v3-pro-motion-control" ||
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
        : null;
  const customerBillableSeconds =
    selectedModel.id === "kling-v3-pro-motion-control"
      ? selectedKlingSeconds
      : null;
  const customerCredits = customerBillableSeconds
    ? quoteXerianoCredits({
        modelId: "kling-v3-pro-motion-control",
        durationSeconds: customerBillableSeconds,
      })
    : null;
  const selectedCustomerModelConfig =
    selectedModel.id === "seedance-2.5" ||
    selectedModel.id === "kling-v3-pro-motion-control"
      ? props.customerConfig?.models[selectedModel.id]
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

  const buildSetup = useCallback((): UgcVideoGenerationSetup | null => {
    if (references.length > effectiveLimit) {
      setNotice({
        kind: "ERROR",
        text: `Für ${selectedModel.name} sind zu viele Referenzen ausgewählt.`,
      });
      return null;
    }
    if (
      references.some((reference) => reference.mediaType === "AUDIO") &&
      !references.some((reference) => reference.mediaType !== "AUDIO")
    ) {
      setNotice({
        kind: "ERROR",
        text: "Eine Audio-Referenz benötigt mindestens ein Bild oder Video.",
      });
      return null;
    }
    const parsed = ugcVideoGenerationSetupSchema.safeParse({
      contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
      prompt,
      modelId,
      duration,
      aspectRatio,
      quality,
      bitrate,
      videoType,
      references: references.map(referenceMetadata),
      advanced,
      klingMotion,
    });
    if (!parsed.success) {
      setNotice({
        kind: "ERROR",
        text: prompt.trim()
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
    return parsed.data;
  }, [
    advanced,
    aspectRatio,
    bitrate,
    duration,
    effectiveLimit,
    modelId,
    klingMotion,
    prompt,
    quality,
    references,
    selectedModel.id,
    selectedModel.name,
    videoType,
  ]);

  const loadSetup = useCallback((setup: UgcVideoGenerationSetup) => {
    setPrompt(setup.prompt);
    setModelId(ugcVideoModelById(setup.modelId)?.id ?? setup.modelId);
    setDuration(setup.duration);
    setAspectRatio(setup.aspectRatio);
    setQuality(setup.quality);
    setBitrate(setup.bitrate);
    setVideoType(setup.videoType);
    setAdvanced(setup.advanced);
    setKlingMotion(setup.klingMotion);
    setView("CREATE");
    setNotice(
      setup.references.length
        ? {
            kind: "INFO",
            text: "Prompt und Einstellungen wurden geladen. Die ursprünglichen Referenzdateien fügst du erneut hinzu.",
          }
        : { kind: "SUCCESS", text: "Setup wurde geladen." },
    );
  }, []);

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
        prompt: setup.prompt,
        modelId: setup.modelId,
        duration: setup.duration,
        aspectRatio: setup.aspectRatio,
        quality: setup.quality,
        bitrate: setup.bitrate,
        videoType: setup.videoType,
        advanced: setup.advanced,
        klingMotion: setup.klingMotion,
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
      setReferences((current) => [
        ...current,
        ...accepted.map((file, index) =>
          createReference(file, current.length + index),
        ),
      ]);
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

  const removeReference = (id: string) =>
    setReferences((current) =>
      current
        .filter((reference) => {
          if (reference.id === id) URL.revokeObjectURL(reference.previewUrl);
          return reference.id !== id;
        })
        .map((reference, order) => ({ ...reference, order })),
    );

  const clearReferences = () => {
    references.forEach((reference) => URL.revokeObjectURL(reference.previewUrl));
    setReferences([]);
  };

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
    if (!props.customerMode && !selectedProviderConfig?.ready) {
      setNotice({
        kind: "ERROR",
        text: !selectedProviderConfig?.costCapConfigured
          ? "Das Kostenlimit für dieses Modell ist noch nicht eingerichtet."
          : `${selectedModel.name} ist serverseitig noch nicht vollständig eingerichtet.`,
        details: [
          !selectedProviderConfig?.credentialConfigured ? "FAL_KEY fehlt." : null,
          !selectedProviderConfig?.costCapConfigured
            ? `${selectedProviderConfig?.costCapEnvironmentName ?? "Das modellspezifische Kostenlimit"} fehlt oder ist ungültig.`
            : null,
          !selectedProviderConfig?.storageConfigured
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
        references,
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
    references,
    props.customerMode,
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

  const changeModel = (nextId: string) => {
    const model = ugcVideoModelById(nextId);
    if (!model) return;
    setModelId(nextId);
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
    <main className="ugc-video-studio-shell">
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

          <div className="uv-workspace">
            <div className="uv-main-column">
              <UgcReferenceUploader
                references={references}
                effectiveLimit={effectiveLimit}
                onAdd={addReferences}
                onRemove={removeReference}
                onClear={clearReferences}
                onRoleChange={(id: string, role: UgcVideoReferenceRole) => setReferences((current) => current.map((reference) => reference.id === id ? { ...reference, role } : reference))}
                onDuration={(id, seconds) => setReferences((current) => current.map((reference) => reference.id === id ? { ...reference, durationSeconds: seconds } : reference))}
              />

              <section className="uv-card uv-prompt-card">
                <div className="uv-section-heading"><div><span>02</span><div><h2>Prompt</h2><p>Szene, Kamera, Bewegung und Stimmung frei beschreiben.</p></div></div><button type="button" className="uv-prompt-save" disabled={!prompt.trim()} onClick={() => openSave()}><Save size={14} /> Prompt speichern</button></div>
                <textarea value={prompt} maxLength={12000} onChange={(event) => setPrompt(event.target.value)} placeholder="Beschreibe dein UGC-Video, die Szene, Kamera, Bewegung und gewünschte Stimmung …" />
                <div className="uv-prompt-meta"><span>{prompt.length.toLocaleString("de-DE")} / 12.000</span><button type="button" disabled={!prompt} onClick={() => setPrompt("")}>Leeren</button></div>
                <div className="uv-prompt-tags" aria-label="Prompt-Ideen">{QUICK_TAGS.map((tag) => <button type="button" key={tag} onClick={() => setPrompt((current) => `${current}${current.trim() ? ", " : ""}${tag}`)}>{tag}</button>)}</div>
                <div className="uv-video-types"><span>Video-Typ</span><div>{UGC_VIDEO_TYPES.map((type) => <button type="button" key={type} className={videoType === type ? "is-active" : ""} onClick={() => setVideoType(type)}>{UGC_VIDEO_TYPE_LABELS[type]}</button>)}</div></div>
              </section>

              <section className="uv-card uv-settings-card">
                <div className="uv-section-heading uv-section-heading--compact"><div><span>03</span><div><h2>Videoeinstellungen</h2><p>Schnell wählen und weiter.</p></div></div></div>
                {selectedModel.settingsKind === "KLING_MOTION_CONTROL" ? (
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
                <div className="uv-cost"><div><span>{props.ownerMode?"Owner Plan":props.customerMode?"Credit-Preis":"Geschätzte Maximalkosten"}</span><strong>{props.ownerMode?"Unlimited":props.customerMode?(customerCredits!==null?`${customerCredits} Credits`:selectedModel.settingsKind === "KLING_MOTION_CONTROL"?"Videolänge wählen":"Für Kunden nicht verfügbar"):estimatedMaximumCostUsd === null ? "Nicht verfügbar" : `${estimatedMaximumCostUsd.toFixed(2).replace(".", ",")} $`}</strong></div><p>{props.ownerMode?"Keine Credit-Abbuchung · Provider-Kostenlimit bleibt aktiv.":props.customerMode?`${availableCredits.toLocaleString("de-DE")} Credits verfügbar.`:selectedModel.settingsKind === "KLING_MOTION_CONTROL" ? `Konservatives fal-Maximum für ${duration} Sekunden Ausgabe.` : references.some((reference) => reference.mediaType === "VIDEO") ? "Konservatives Maximum inklusive dokumentiertem Video-Referenzbudget." : "Tokenbasierte fal-Schätzung für Dauer, Format und Qualität."}</p>{!productMode&&props.providerConfig?<p>V1-Speicherlimit: {Math.round(props.providerConfig.resultStorageLimitBytes / 1024 / 1024)} MB pro Ergebnis.</p>:null}</div>
              </section>
            </div>

            <aside className="uv-side-column">
              <UgcModelSelector modelId={modelId} open={modelOpen} onOpen={() => setModelOpen(true)} onClose={() => setModelOpen(false)} onChange={changeModel} customerMode={props.customerMode} />
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
                  <video src={result.url} controls playsInline preload="metadata" />
                  <div><strong>{UGC_VIDEO_TYPE_LABELS[activeRun.setup.videoType]}</strong><span>{activeRun.setup.modelId === "kling-v3-pro-motion-control" ? `${activeRun.setup.klingMotion.characterOrientation === "VIDEO" ? "Bewegung folgen" : "Bild folgen"}${activeRun.setup.klingMotion.keepOriginalSound ? " · Originalton" : ""}` : `${activeRun.setup.duration}s · ${activeRun.setup.aspectRatio} · ${activeRun.setup.quality}`}</span></div>
                  <footer>
                    <a href={result.downloadUrl}><Download size={15} /> Herunterladen</a>
                    <button type="button" onClick={() => setLargeResult(result)}><Maximize2 size={15} /> Vergrößern</button>
                    <button type="button" onClick={() => addResultAsReference(result)}><PlusReferenceIcon /> Als Referenz</button>
                    {productMode ? <button type="button" onClick={() => void saveResultToLibrary(result.id)}><Bookmark size={15} /> In Bibliothek speichern</button> : null}
                    <button type="button" onClick={() => toggleResultFavorite(result)} aria-label="Favorit"><Heart size={15} fill={result.favorite ? "currentColor" : "none"} /></button>
                    <button type="button" onClick={() => navigator.clipboard.writeText(activeRun.setup.prompt)}><Clipboard size={15} /> Prompt kopieren</button>
                    <button type="button" onClick={() => loadSetup(activeRun.setup)}><RotateCcw size={15} /> Neu erstellen</button>
                  </footer>
                </article>
              ))}</div>
            ) : activeRun?.status === "FAILED" || activeRun?.status === "UNKNOWN_OUTCOME" ? (
              <div className="uv-result-empty uv-result-empty--failed">
                <X size={29} />
                <h3>{activeRun.status === "FAILED" ? "Das Video konnte nicht erstellt werden." : "Der Anbieterstatus ist unklar."}</h3>
                <p>{activeRun.status === "FAILED" ? "Unter Details findest du die bereinigte Anbieter-Meldung, sofern sie verfügbar ist." : "Es wird kein neuer Auftrag gestartet."}</p>
                <UgcProviderDetails run={activeRun} />
              </div>
            ) : (
              <div className="uv-result-empty"><Play size={29} /><h3>Bereit für dein erstes Video</h3><p>Hier erscheint dein dauerhaft gespeichertes Ergebnis. Es werden keine Beispielvideos erfunden.</p></div>
            )}
          </section>

          <div className="uv-generate-bar"><button type="button" className="uv-generate" disabled={generating || activeRun?.status === "RUNNING" || !prompt.trim() || !klingDurationAllowed || Boolean(props.customerMode&&(customerModelUnavailable||customerCredits===null||insufficientCustomerCredits||customerConcurrencyReached))} onClick={generate}>{generating || activeRun?.status === "RUNNING" ? <><Loader2 className="is-spinning" size={19} /> Video wird erstellt …</> : <><Sparkles size={19} /> {props.customerMode&&customerCredits!==null?`Generieren · ${customerCredits} Credits`:"Generieren"}</>}</button>{props.ownerMode?<small className="uv-owner-unlimited">Owner · Unlimited</small>:null}</div>
        </div>
      ) : view === "PROMPTS" ? (
        <UgcPromptLibrary
          prompts={persisted.prompts}
          onLoad={(saved) => {
            const setup = ugcVideoGenerationSetupSchema.parse({
              contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
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
            });
            loadSetup(setup);
            persist(upsertUgcVideoPrompt(persisted, { ...saved, lastUsedAt: nowIso() }));
          }}
          onEdit={(saved) => { setEditingPrompt(saved); setSaveSource(ugcVideoGenerationSetupSchema.parse({ contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION, prompt: saved.prompt, modelId: saved.modelId, duration: saved.duration, aspectRatio: saved.aspectRatio, quality: saved.quality, bitrate: saved.bitrate, videoType: saved.videoType, references: [], advanced: saved.advanced, klingMotion: saved.klingMotion })); setSaveOpen(true); }}
          onDuplicate={(saved) => persist(upsertUgcVideoPrompt(persisted, { ...saved, id: createUgcVideoClientId(), title: `${saved.title} – Kopie`, favorite: false, createdAt: nowIso(), updatedAt: nowIso(), lastUsedAt: null }))}
          onFavorite={(saved) => persist(upsertUgcVideoPrompt(persisted, { ...saved, favorite: !saved.favorite, updatedAt: nowIso() }))}
          onDelete={(id) => persist(removeUgcVideoPrompt(persisted, id))}
        />
      ) : (
        <UgcRunHistory
          runs={persisted.runs}
          onLoadSetup={loadSetup}
          onSavePrompt={openSave}
          onOpen={(run) => { setActiveRun(run); setView("CREATE"); window.setTimeout(() => document.getElementById("uv-results-title")?.scrollIntoView({ behavior: "smooth" }), 0); }}
        />
      )}

      <UgcPromptSaveDialog open={saveOpen} editing={editingPrompt} onClose={() => { setSaveOpen(false); setSaveSource(null); setEditingPrompt(null); }} onSave={savePrompt} />
      {largeResult ? <div className="uv-video-modal" role="presentation" onPointerDown={() => setLargeResult(null)}><section role="dialog" aria-modal="true" aria-label="Video vergrößern" onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setLargeResult(null)} aria-label="Schließen"><X size={19} /></button><video src={largeResult.url} controls autoPlay playsInline /></section></div> : null}
    </main>
  );
}

function PlusReferenceIcon() {
  return <Video size={15} />;
}
