"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bookmark,
  Check,
  Download,
  Heart,
  History,
  ImagePlus,
  Loader2,
  Maximize2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AdvancedPanel,
  ModelSelector,
  PromptSaveDialog,
  QuickControlButtons,
  ReferenceUploader,
} from "@/components/creative-studio/creative-studio-controls";
import {
  PromptLibrary,
  RunHistory,
} from "@/components/creative-studio/creative-studio-library";

import {
  CREATIVE_GLOBAL_REFERENCE_LIMIT,
  CREATIVE_OUTPUT_TYPE_LABELS,
  CREATIVE_OUTPUT_TYPES,
  CREATIVE_REFERENCE_MAX_BYTES,
  CREATIVE_REFERENCE_MIME_TYPES,
  CREATIVE_REFERENCE_TOTAL_MAX_BYTES,
  CREATIVE_STUDIO_CONTRACT_VERSION,
  DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  creativeGenerationSetupSchema,
  type CreativeGenerationSetup,
  type CreativeReferenceImage,
  type CreativeReferenceSnapshotEntry,
  type CreativeReferenceSource,
  type CreativeRun,
  type CreativeStudioPersistedState,
  type SavedCreativePrompt,
} from "@/lib/creative-studio/contracts";
import {
  CreativeGenerationClientError,
  fetchCreativeAccountHistory,
  fetchCreativeGenerationJob,
  submitCreativeGeneration,
} from "@/lib/creative-studio/client";
import { createCreativeClientId } from "@/lib/creative-studio/client-id";
import {
  buildCreativeReferenceSnapshot,
  fallbackSnapshotFromRun,
  fetchCreativeReferenceSnapshot,
  mergeCreativeRunClientState,
  recoverCreativeReferenceBlobs,
  saveCreativeReferenceSnapshot,
} from "@/lib/creative-studio/reference-recovery";
import {
  CREATIVE_MODEL_REGISTRY,
  DEFAULT_CREATIVE_MODEL_ID,
  creativeModelById,
} from "@/lib/creative-studio/model-registry";
import {
  loadCreativeStudioState,
  removeCreativePrompt,
  saveCreativeStudioState,
  upsertCreativePrompt,
  upsertCreativeRun,
} from "@/lib/creative-studio/persistence";
import type { CreativeProviderPublicConfig } from "@/lib/creative-studio/nano-banana-config";
import type { XerianoCreativeCustomerConfig } from "@/lib/xeriano/customer-config";
import type { XerianoCustomerStudioStatus } from "@/lib/xeriano/client-contracts";
import { quoteXerianoCredits } from "@/lib/xeriano/pricing";
import { xerianoCreationSchema } from "@/lib/xeriano/creation-contracts";

type StudioView = "CREATE" | "PROMPTS" | "HISTORY";

const VIEW_LABELS: Record<StudioView, string> = {
  CREATE: "Erstellen",
  PROMPTS: "Prompt-Bibliothek",
  HISTORY: "Verlauf",
};

const PROMPT_IDEAS = [
  "Fotorealistisch",
  "Editoriales Licht",
  "Produkt im Fokus",
  "Hochwertige Kampagne",
] as const;

function nowIso() {
  return new Date().toISOString();
}

function formatGermanDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function createReference(
  file: File,
  order: number,
  source: CreativeReferenceSource = { kind: "LOCAL_FILE_REFERENCE" },
): CreativeReferenceImage {
  return {
    id: createCreativeClientId(),
    name: file.name,
    mimeType: file.type,
    byteLength: file.size,
    role: "NONE",
    order,
    previewUrl: URL.createObjectURL(file),
    file,
    source,
  };
}

function referenceMetadata(reference: CreativeReferenceImage) {
  return {
    id: reference.id,
    name: reference.name,
    mimeType: reference.mimeType,
    byteLength: reference.byteLength,
    role: reference.role,
    order: reference.order,
  };
}

export function CreativeStudioWorkspace(props: {
  providerConfig?: CreativeProviderPublicConfig;
  customerConfig?: XerianoCreativeCustomerConfig;
  customerStatus?: XerianoCustomerStudioStatus;
  customerMode?: boolean;
  initialLibraryAssetId?: string;
  initialCreationId?: string;
  initialCreationMode?: "edit" | "recreate";
}) {
  const [view, setView] = useState<StudioView>("CREATE");
  const [persisted, setPersisted] = useState<CreativeStudioPersistedState>({
    version: 1,
    prompts: [],
    runs: [],
  });
  const [hydrated, setHydrated] = useState(false);
  const [references, setReferences] = useState<CreativeReferenceImage[]>([]);
  const [missingReferences, setMissingReferences] = useState<
    CreativeReferenceSnapshotEntry[]
  >([]);
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_CREATIVE_MODEL_ID);
  const [aspectRatio, setAspectRatio] =
    useState<CreativeGenerationSetup["aspectRatio"]>("4:5");
  const [quality, setQuality] =
    useState<CreativeGenerationSetup["quality"]>("2K");
  const [batchSize, setBatchSize] =
    useState<CreativeGenerationSetup["batchSize"]>(1);
  const [outputType, setOutputType] =
    useState<CreativeGenerationSetup["outputType"]>("SOCIAL_ASSET");
  const [advanced, setAdvanced] = useState<CreativeGenerationSetup["advanced"]>(
    { ...DEFAULT_CREATIVE_ADVANCED_SETTINGS },
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [promptSaveSource, setPromptSaveSource] =
    useState<CreativeGenerationSetup | null>(null);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SavedCreativePrompt | null>(
    null,
  );
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "INFO" | "ERROR" | "SUCCESS";
    text: string;
    details?: string;
  } | null>(null);
  const [activeRun, setActiveRun] = useState<CreativeRun | null>(null);
  const [availableCredits, setAvailableCredits] = useState(
    props.customerStatus?.availableCredits ?? 0,
  );
  const referencesRef = useRef(references);
  const generationLockRef = useRef(false);
  const initialLibraryAssetLoadedRef = useRef(false);
  const initialCreationLoadedRef = useRef(false);
  const creationSyncAttemptedRef = useRef(new Set<string>());
  referencesRef.current = references;

  useEffect(() => {
    const restored = loadCreativeStudioState(window.localStorage);
    const initial = props.customerMode
      ? { ...restored, runs: [] }
      : restored;
    if (props.customerMode && restored.runs.length) {
      saveCreativeStudioState(window.localStorage, { ...restored, runs: [] });
    }
    setPersisted(initial);
    setActiveRun(initial.runs[0] ?? null);
    setHydrated(true);
    let cancelled = false;
    if (props.customerMode) {
      void fetchCreativeAccountHistory()
        .then((runs) => {
          if (cancelled) return;
          setPersisted((current) => ({ ...current, runs }));
          setActiveRun((current) => current ?? runs[0] ?? null);
        })
        .catch(() => {
          if (!cancelled) {
            setNotice({ kind: "ERROR", text: "Der Verlauf ist gerade nicht verfügbar." });
          }
        });
    }
    return () => {
      cancelled = true;
      referencesRef.current.forEach((reference) =>
        URL.revokeObjectURL(reference.previewUrl),
      );
    };
  }, [props.customerMode]);

  const persist = useCallback((next: CreativeStudioPersistedState) => {
    const saved = saveCreativeStudioState(
      window.localStorage,
      props.customerMode ? { ...next, runs: [] } : next,
    );
    setPersisted(props.customerMode ? next : saved);
  }, [props.customerMode]);

  const persistRun = useCallback((run: CreativeRun) => {
    if (props.customerMode) {
      setPersisted((current) => upsertCreativeRun(current, run));
      return;
    }
    persist(
      upsertCreativeRun(loadCreativeStudioState(window.localStorage), run),
    );
  }, [persist, props.customerMode]);

  useEffect(() => {
    if (!props.customerMode || activeRun?.status !== "RUNNING") return;
    let cancelled = false;
    const observe = async () => {
      try {
        const run = await fetchCreativeGenerationJob({
          jobId: activeRun.id,
          onCredit: (receipt) => setAvailableCredits(receipt.availableCredits),
        });
        if (cancelled) return;
        const merged = mergeCreativeRunClientState(
          run,
          activeRun,
        );
        persistRun(merged);
        setActiveRun(merged);
      } catch {
        // A status read never resubmits the paid job. Try again while RUNNING.
      }
    };
    const interval = window.setInterval(() => void observe(), 5_000);
    void observe();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeRun, persistRun, props.customerMode]);

  useEffect(() => {
    if (
      !props.customerMode ||
      !activeRun ||
      !["SUCCEEDED", "PARTIALLY_SUCCEEDED"].includes(activeRun.status) ||
      !activeRun.results.some((result) => !result.creationId) ||
      creationSyncAttemptedRef.current.has(activeRun.id)
    ) return;
    creationSyncAttemptedRef.current.add(activeRun.id);
    void (async () => {
      try {
        const observed = await fetchCreativeGenerationJob({
          jobId: activeRun.id,
          onCredit: (receipt) => setAvailableCredits(receipt.availableCredits),
        });
        const merged = mergeCreativeRunClientState(observed, activeRun);
        persistRun(merged);
        setActiveRun(merged);
      } catch {
        // Historical jobs can lack Creation provenance. One bounded read is
        // enough; this path never reserves credits or submits a provider job.
      }
    })();
  }, [activeRun, persistRun, props.customerMode]);

  const selectedModel =
    creativeModelById(modelId) ?? CREATIVE_MODEL_REGISTRY[0]!;
  const effectiveReferenceLimit = Math.min(
    CREATIVE_GLOBAL_REFERENCE_LIMIT,
    selectedModel.maximumReferences,
  );
  const tooManyReferences = references.length > effectiveReferenceLimit;
  const estimatedMaximumCostUsd = Number(
    ((quality === "4K"
      ? props.providerConfig?.pricesUsd.fourK ?? 0
      : props.providerConfig?.pricesUsd.standard ?? 0) * batchSize).toFixed(2),
  );
  const customerCredits = quoteXerianoCredits({ modelId: "nano-banana-pro", quality, count: batchSize });
  const insufficientCustomerCredits = Boolean(
    props.customerMode && availableCredits < customerCredits,
  );
  const customerConcurrencyReached = Boolean(
    props.customerMode &&
      props.customerStatus &&
      props.customerStatus.activeImageJobs >=
        props.customerStatus.imageConcurrencyLimit,
  );

  const buildSetup = useCallback((): CreativeGenerationSetup | null => {
    if (references.length > effectiveReferenceLimit) {
      setNotice({
        kind: "ERROR",
        text: `${selectedModel.name} unterstützt höchstens ${effectiveReferenceLimit} Referenzen. Entferne zuerst ${references.length - effectiveReferenceLimit}.`,
      });
      return null;
    }
    const parsed = creativeGenerationSetupSchema.safeParse({
      contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
      prompt,
      modelId,
      aspectRatio,
      quality,
      batchSize,
      outputType,
      references: references.map(referenceMetadata),
      advanced,
    });
    if (!parsed.success) {
      setNotice({
        kind: "ERROR",
        text: prompt.trim()
          ? "Bitte prüfe dein Setup."
          : "Schreibe zuerst einen Prompt.",
      });
      return null;
    }
    return parsed.data;
  }, [
    advanced,
    aspectRatio,
    batchSize,
    effectiveReferenceLimit,
    modelId,
    outputType,
    prompt,
    quality,
    references,
    selectedModel.name,
  ]);

  const loadSetup = useCallback((setup: CreativeGenerationSetup) => {
    setPrompt(setup.prompt);
    setModelId(creativeModelById(setup.modelId)?.id ?? setup.modelId);
    setAspectRatio(setup.aspectRatio);
    setQuality(setup.quality);
    setBatchSize(setup.batchSize);
    setOutputType(setup.outputType);
    setAdvanced(setup.advanced);
    setView("CREATE");
    setNotice({ kind: "SUCCESS", text: "Setup wurde geladen." });
  }, []);

  const reopenRunSetup = useCallback(
    async (run: CreativeRun) => {
      loadSetup(run.setup);
      let snapshot = run.referenceSnapshot ?? fallbackSnapshotFromRun(run);
      if (props.customerMode) {
        try {
          snapshot =
            (await fetchCreativeReferenceSnapshot({ jobId: run.id })) ??
            snapshot;
        } catch {
          // The local metadata snapshot remains a safe fallback. No generation
          // or credit operation is triggered by setup recovery.
        }
      }

      const recovered = await recoverCreativeReferenceBlobs({ snapshot });
      const nextReferences = recovered.restored.map(({ entry, blob }) => {
        const file = new File([blob], entry.filename, {
          type: blob.type || entry.mimeType,
        });
        return {
          ...createReference(file, entry.order, entry.source),
          id: entry.referenceId,
          name: entry.filename,
          mimeType: blob.type || entry.mimeType,
          byteLength: blob.size,
          role: entry.role,
          order: entry.order,
        } satisfies CreativeReferenceImage;
      });
      referencesRef.current.forEach((reference) =>
        URL.revokeObjectURL(reference.previewUrl),
      );
      const unresolved = [...recovered.localOnly, ...recovered.unavailable].sort(
        (a, b) => a.order - b.order,
      );
      setReferences(nextReferences);
      setMissingReferences(unresolved);
      referencesRef.current = nextReferences;
      setView("CREATE");

      if (recovered.localOnly.length) {
        setNotice({
          kind: "INFO",
          text: "Diese lokale Referenz musst du erneut hinzufügen.",
          ...(recovered.unavailable.length
            ? {
                details:
                  "Mindestens eine dauerhaft gespeicherte Referenz ist gerade nicht verfügbar.",
              }
            : {}),
        });
      } else if (recovered.unavailable.length) {
        setNotice({
          kind: "ERROR",
          text: "Mindestens eine gespeicherte Referenz konnte gerade nicht geladen werden.",
        });
      } else {
        setNotice({
          kind: "SUCCESS",
          text: snapshot.references.length
            ? snapshot.references.length === 1
              ? "Setup und 1 Referenz wurden geladen."
              : `Setup und ${snapshot.references.length} Referenzen wurden geladen.`
            : "Setup wurde geladen.",
        });
      }
    },
    [loadSetup, props.customerMode],
  );

  const savePrompt = useCallback(
    (
      metadata: { title: string; description: string; tags: string[] },
      sourceSetup?: CreativeGenerationSetup,
      forceNew = false,
    ) => {
      const setup = sourceSetup ?? buildSetup();
      if (!setup) return;
      const existing = forceNew ? null : editingPrompt;
      const timestamp = nowIso();
      const record: SavedCreativePrompt = {
        id: existing?.id ?? createCreativeClientId(),
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        favorite: existing?.favorite ?? false,
        prompt: setup.prompt,
        modelId: setup.modelId,
        aspectRatio: setup.aspectRatio,
        quality: setup.quality,
        batchSize: setup.batchSize,
        outputType: setup.outputType,
        advanced: setup.advanced,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        lastUsedAt: existing?.lastUsedAt ?? null,
      };
      persist(upsertCreativePrompt(persisted, record));
      setSaveDialogOpen(false);
      setPromptSaveSource(null);
      setEditingPrompt(null);
      setNotice({
        kind: "SUCCESS",
        text: existing
          ? "Prompt wurde aktualisiert."
          : "Prompt wurde gespeichert.",
      });
    },
    [buildSetup, editingPrompt, persist, persisted],
  );

  const generate = useCallback(async () => {
    if (generationLockRef.current) return;
    const setup = buildSetup();
    if (!setup) return;
    const model = creativeModelById(setup.modelId);
    if (model?.availability !== "LIVE") {
      const timestamp = nowIso();
      const run: CreativeRun = {
        id: createCreativeClientId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        status: "PROVIDER_NOT_CONNECTED",
        setup,
        results: [],
        message: `${model?.name ?? "Dieses Modell"} ist noch nicht live verbunden. Es wurde kein kostenpflichtiger Aufruf ausgeführt.`,
      };
      persistRun(run);
      setActiveRun(run);
      setNotice({ kind: "INFO", text: run.message! });
      return;
    }
    if (props.customerMode && !props.customerConfig?.ready) {
      setNotice({
        kind: "ERROR",
        text: "Nano Banana Pro ist für Kunden gerade nicht verfügbar.",
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
        text: "Du hast bereits die maximale Anzahl gleichzeitiger Bildgenerierungen erreicht.",
      });
      return;
    }
    if (!props.customerMode && !props.providerConfig?.ready) {
      setNotice({
        kind: "ERROR",
        text: !props.providerConfig?.costCapConfigured
          ? "Das Kostenlimit für dieses Modell ist noch nicht eingerichtet."
          : "Nano Banana Pro ist serverseitig noch nicht vollständig eingerichtet.",
        details: [
          !props.providerConfig?.credentialConfigured ? "FAL_KEY fehlt." : null,
          !props.providerConfig?.costCapConfigured
            ? "NEXHQ_CREATIVE_NANO_BANANA_COST_MAX_USD fehlt oder ist ungültig."
            : null,
          !props.providerConfig?.storageConfigured
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
      (props.providerConfig?.costCapUsd === null ||
      props.providerConfig?.costCapUsd === undefined ||
      estimatedMaximumCostUsd > props.providerConfig.costCapUsd)
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
    const jobId = createCreativeClientId();
    const referenceSnapshot = buildCreativeReferenceSnapshot({
      jobId,
      references,
      createdAt: timestamp,
    });
    const provisional: CreativeRun = {
      id: jobId,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: "RUNNING",
      setup,
      results: [],
      message: "Nano Banana Pro erstellt deine Bilder …",
      provider: "fal",
      providerModel: props.customerMode
        ? props.customerConfig?.displayName
        : props.providerConfig?.providerModel,
      providerRequestId: null,
      referenceSnapshot,
      ...(props.customerMode ? {} : { estimatedMaximumCostUsd }),
    };
    persistRun(provisional);
    setActiveRun(provisional);
    try {
      if (props.customerMode) {
        try {
          const durableSnapshot = await saveCreativeReferenceSnapshot({
            snapshot: referenceSnapshot,
          });
          provisional.referenceSnapshot = durableSnapshot;
          persistRun(provisional);
          setActiveRun(provisional);
        } catch {
          // Recovery metadata is a sidecar. A temporary sidecar failure must
          // not rewrite or alter the already-authorized provider payload.
        }
      }
      const run = await submitCreativeGeneration({
        jobId,
        setup,
        references,
        ...(props.customerMode ? { referenceSnapshot } : {}),
        ...(props.customerMode
          ? { onCredit: (receipt) => setAvailableCredits(receipt.availableCredits) }
          : {}),
      });
      const mergedRun = mergeCreativeRunClientState(run, provisional);
      persistRun(mergedRun);
      setActiveRun(mergedRun);
      setNotice({
        kind:
          mergedRun.status === "SUCCEEDED" ||
          mergedRun.status === "PARTIALLY_SUCCEEDED"
            ? "SUCCESS"
            : "ERROR",
        text: mergedRun.message ?? "Der Auftrag wurde abgeschlossen.",
      });
    } catch (error) {
      const knownPreflightFailure =
        error instanceof CreativeGenerationClientError &&
        [
          "AUTHENTICATION_REQUIRED",
          "INVALID_REQUEST",
          "REFERENCE_LIMIT_EXCEEDED",
          "REFERENCE_INVALID",
          "PROVIDER_NOT_CONFIGURED",
          "CREATIVE_COST_CAP_NOT_CONFIGURED",
          "IDEMPOTENCY_CONFLICT",
          "INSUFFICIENT_CREDITS",
          "CONCURRENCY_LIMIT_REACHED",
          "CUSTOMER_MODEL_UNAVAILABLE",
          "ACCOUNT_NOT_ACTIVE",
          "XERIANO_CREDIT_AUTHORITY_UNAVAILABLE",
          "GENERATION_ALREADY_STARTED",
          "CUSTOMER_ACCOUNT_REQUIRED",
        ].includes(error.code);
      const failed: CreativeRun = {
        ...provisional,
        updatedAt: nowIso(),
        status: knownPreflightFailure ? "FAILED" : "UNKNOWN_OUTCOME",
        message:
          knownPreflightFailure && error instanceof CreativeGenerationClientError
            ? error.message
            : "Der Anbieterstatus ist unklar. Der Auftrag wird nicht automatisch erneut gesendet.",
      };
      persistRun(failed);
      setActiveRun(failed);
      setNotice({
        kind: "ERROR",
        text: failed.message!,
        ...(error instanceof CreativeGenerationClientError &&
        error.technicalDetails
          ? { details: error.technicalDetails }
          : {}),
      });
    } finally {
      generationLockRef.current = false;
      setGenerating(false);
    }
  }, [
    buildSetup,
    estimatedMaximumCostUsd,
    persistRun,
    props.providerConfig,
    props.customerConfig,
    props.customerMode,
    references,
    insufficientCustomerCredits,
    customerConcurrencyReached,
  ]);

  const addReferenceEntries = useCallback((entries: Array<{
    file: File;
    source: CreativeReferenceSource;
    role?: CreativeReferenceImage["role"];
  }>) => {
    const supported = entries.filter(
      ({ file }) =>
        CREATIVE_REFERENCE_MIME_TYPES.includes(
          file.type as (typeof CREATIVE_REFERENCE_MIME_TYPES)[number],
        ) && file.size <= CREATIVE_REFERENCE_MAX_BYTES,
    );
    const currentBytes = references.reduce(
      (sum, reference) => sum + reference.byteLength,
      0,
    );
    let selectedBytes = currentBytes;
    const withinTotal = supported.filter(({ file }) => {
      if (selectedBytes + file.size > CREATIVE_REFERENCE_TOTAL_MAX_BYTES) {
        return false;
      }
      selectedBytes += file.size;
      return true;
    });
    const available = Math.max(0, effectiveReferenceLimit - references.length);
    const accepted = withinTotal.slice(0, available);
    const nextOrder = Math.max(
      -1,
      ...references.map((reference) => reference.order),
      ...missingReferences.map((reference) => reference.order),
    ) + 1;
    setReferences((current) => [
      ...current,
      ...accepted.map(({ file, source, role }, index) => ({
        ...createReference(file, nextOrder + index, source),
        ...(role ? { role } : {}),
      })),
    ]);
    if (accepted.length !== entries.length) {
      setNotice({
        kind: "INFO",
        text: `Einige Dateien wurden nicht hinzugefügt. Erlaubt sind PNG, JPG, WebP oder AVIF bis 8 MB pro Bild und 18 MB insgesamt; ${selectedModel.name} unterstützt bis zu ${effectiveReferenceLimit} Referenzen.`,
      });
    }
  }, [effectiveReferenceLimit, missingReferences, references, selectedModel.name]);

  const addReferences = useCallback(
    (files: File[]) =>
      addReferenceEntries(
        files.map((file) => ({
          file,
          source: { kind: "LOCAL_FILE_REFERENCE" } as const,
        })),
      ),
    [addReferenceEntries],
  );

  useEffect(() => {
    if (!props.initialLibraryAssetId || initialLibraryAssetLoadedRef.current) return;
    initialLibraryAssetLoadedRef.current = true;
    void (async () => {
      try {
        const response = await fetch(`/api/xeriano/library/${encodeURIComponent(props.initialLibraryAssetId!)}/content`, { credentials: "same-origin" });
        if (!response.ok) throw new Error("library_asset_unavailable");
        const blob = await response.blob();
        const extension = blob.type === "image/jpeg" ? "jpg" : blob.type.split("/")[1] ?? "png";
        addReferenceEntries([
          {
            file: new File([blob], `xeriano-design.${extension}`, {
              type: blob.type,
            }),
            source: {
              kind: "LIBRARY_REFERENCE",
              libraryAssetId: props.initialLibraryAssetId!,
            },
            role: "DESIGN",
          },
        ]);
        setNotice({ kind: "SUCCESS", text: "Das Design wurde aus deiner Bibliothek als Referenz hinzugefügt." });
      } catch { setNotice({ kind: "ERROR", text: "Das Bibliotheks-Asset konnte nicht als Referenz geladen werden." }); }
    })();
  }, [addReferenceEntries, props.initialLibraryAssetId]);

  useEffect(() => {
    if (
      !props.customerMode ||
      !props.initialCreationId ||
      !props.initialCreationMode ||
      initialCreationLoadedRef.current
    ) return;
    initialCreationLoadedRef.current = true;
    void (async () => {
      try {
        const response = await fetch(
          `/api/xeriano/creations/${encodeURIComponent(props.initialCreationId!)}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        const payload = (await response.json()) as { creation?: unknown };
        if (!response.ok || !payload.creation) throw new Error("creation_unavailable");
        const creation = xerianoCreationSchema.parse(payload.creation);
        if (creation.creationType !== "IMAGE") throw new Error("creation_not_image");
        const settings = creation.settings;
        const setup = creativeGenerationSetupSchema.parse({
          contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
          prompt: creation.originalPrompt,
          modelId: creation.modelId,
          aspectRatio: settings.aspectRatio,
          quality: settings.quality,
          batchSize: settings.batchSize,
          outputType: settings.outputType,
          advanced: settings.advanced,
          references: [],
        });
        loadSetup(setup);

        const sources: Array<{
          url: string;
          name: string;
          source: CreativeReferenceSource;
          role: CreativeReferenceImage["role"];
        }> = [];
        if (props.initialCreationMode === "edit") {
          sources.push({
            url: creation.resultContentUrl,
            name: `xeriano-kreation-${creation.id}.png`,
            source: {
              kind: "LIBRARY_REFERENCE",
              libraryAssetId: creation.assetId,
            },
            role: "NONE",
          });
        }
        for (const reference of creation.references ?? []) {
          sources.push({
            url: reference.contentUrl,
            name: reference.filename,
            source: reference.source,
            role: reference.role as CreativeReferenceImage["role"],
          });
        }
        const entries = await Promise.all(
          sources.map(async (source) => {
            const referenceResponse = await fetch(source.url, {
              credentials: "same-origin",
              cache: "no-store",
            });
            if (!referenceResponse.ok) throw new Error("creation_reference_unavailable");
            const blob = await referenceResponse.blob();
            return {
              file: new File([blob], source.name, { type: blob.type }),
              source: source.source,
              role: source.role,
            };
          }),
        );
        referencesRef.current.forEach((reference) =>
          URL.revokeObjectURL(reference.previewUrl),
        );
        setReferences([]);
        setMissingReferences([]);
        addReferenceEntries(entries);
        setNotice({
          kind: "SUCCESS",
          text:
            props.initialCreationMode === "edit"
              ? "Bild und Originalkontext sind bereit. Beschreibe jetzt deine Änderung."
              : "Prompt, Referenzen und Einstellungen wurden vollständig geladen.",
        });
      } catch {
        setNotice({
          kind: "ERROR",
          text: "Die Kreation konnte nicht vollständig geöffnet werden.",
        });
      }
    })();
  }, [
    addReferenceEntries,
    loadSetup,
    props.customerMode,
    props.initialCreationId,
    props.initialCreationMode,
  ]);

  const addResultAsReference = useCallback(
    async (result: CreativeRun["results"][number]) => {
      if (references.length >= effectiveReferenceLimit) {
        setNotice({
          kind: "ERROR",
          text: `Für ${selectedModel.name} ist das Referenzlimit bereits erreicht.`,
        });
        return;
      }
      try {
        const response = await fetch(result.url, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`download_${response.status}`);
        const blob = await response.blob();
        const extension = blob.type === "image/jpeg" ? "jpg" : blob.type.split("/")[1] ?? "png";
        const file = new File(
          [blob],
          `creative-ergebnis-${references.length + 1}.${extension}`,
          { type: blob.type || result.mimeType },
        );
        addReferenceEntries([
          {
            file,
            source: {
              kind: "GENERATED_RESULT_REFERENCE",
              sourceJobId: activeRun!.id,
              sourceResultId: result.id,
            },
          },
        ]);
        setNotice({
          kind: "SUCCESS",
          text: "Das Ergebnis wurde als neue Referenz hinzugefügt.",
        });
      } catch {
        setNotice({
          kind: "ERROR",
          text: "Das Ergebnis konnte nicht als Referenz übernommen werden.",
        });
      }
    },
    [
      activeRun,
      addReferenceEntries,
      effectiveReferenceLimit,
      references.length,
      selectedModel.name,
    ],
  );

  const removeReference = (id: string) =>
    setReferences((current) =>
      current
        .filter((reference) => {
          if (reference.id === id) URL.revokeObjectURL(reference.previewUrl);
          return reference.id !== id;
        }),
    );

  const restoreMissingReference = useCallback(
    (referenceId: string, file: File) => {
      const missing = missingReferences.find(
        (reference) => reference.referenceId === referenceId,
      );
      if (!missing) return;
      if (references.length >= effectiveReferenceLimit) {
        setNotice({
          kind: "ERROR",
          text: `Für ${selectedModel.name} ist das Referenzlimit bereits erreicht.`,
        });
        return;
      }
      if (
        !CREATIVE_REFERENCE_MIME_TYPES.includes(
          file.type as (typeof CREATIVE_REFERENCE_MIME_TYPES)[number],
        ) ||
        file.size > CREATIVE_REFERENCE_MAX_BYTES ||
        references.reduce((sum, reference) => sum + reference.byteLength, 0) +
          file.size >
          CREATIVE_REFERENCE_TOTAL_MAX_BYTES
      ) {
        setNotice({
          kind: "ERROR",
          text: "Die Referenz konnte nicht hinzugefügt werden. Prüfe Format und Dateigröße.",
        });
        return;
      }
      const restored: CreativeReferenceImage = {
        ...createReference(file, missing.order, {
          kind: "LOCAL_FILE_REFERENCE",
        }),
        id: missing.referenceId,
        role: missing.role,
      };
      setReferences((current) =>
        [...current, restored].sort((a, b) => a.order - b.order),
      );
      setMissingReferences((current) =>
        current.filter((reference) => reference.referenceId !== referenceId),
      );
      setNotice({ kind: "SUCCESS", text: "Die lokale Referenz wurde wieder hinzugefügt." });
    },
    [
      effectiveReferenceLimit,
      missingReferences,
      references,
      selectedModel.name,
    ],
  );

  const clearReferences = () => {
    references.forEach((reference) => URL.revokeObjectURL(reference.previewUrl));
    setReferences([]);
    setMissingReferences([]);
  };

  const toggleResultFavorite = useCallback(
    async (resultId: string) => {
      if (!activeRun) return;
      const result = activeRun.results.find((candidate) => candidate.id === resultId);
      if (props.customerMode && result?.creationId) {
        const response = await fetch(`/api/xeriano/creations/${result.creationId}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorite: !result.favorite }),
        });
        if (!response.ok) {
          setNotice({ kind: "ERROR", text: "Der Favorit konnte nicht aktualisiert werden." });
          return;
        }
      }
      const updated: CreativeRun = {
        ...activeRun,
        updatedAt: nowIso(),
        results: activeRun.results.map((result) =>
          result.id === resultId
            ? { ...result, favorite: !result.favorite }
            : result,
        ),
      };
      setActiveRun(updated);
      persistRun(updated);
    },
    [activeRun, persistRun, props.customerMode],
  );

  const changeModel = (nextModelId: string) => {
    setModelId(nextModelId);
    const nextModel = creativeModelById(nextModelId);
    if (nextModel && !nextModel.supportedQualities.includes(quality)) {
      setQuality(nextModel.supportedQualities[0] ?? "1K");
      setNotice({
        kind: "INFO",
        text: `Die Qualität wurde auf ${nextModel.supportedQualities[0] ?? "1K"} gesetzt, weil ${nextModel.name} die vorige Auswahl nicht unterstützt.`,
      });
    }
  };

  const openCreate = () => setView("CREATE");

  return (
    <div className="creative-studio-shell">
      <header className="cs-topbar">
        <div className="cs-brand">
          <span>
            <Sparkles size={18} />
          </span>
          <div>
            <strong>Creative Studio</strong>
            <small>Referenzen + Prompt</small>
          </div>
        </div>
        <nav aria-label="Creative Studio Bereiche">
          {(Object.keys(VIEW_LABELS) as StudioView[]).map((item) => (
            <button
              type="button"
              key={item}
              className={view === item ? "is-active" : ""}
              onClick={() => setView(item)}
            >
              {item === "PROMPTS" ? (
                <Bookmark size={15} />
              ) : item === "HISTORY" ? (
                <History size={15} />
              ) : (
                <WandSparkles size={15} />
              )}
              <span className="cs-nav-label">{VIEW_LABELS[item]}</span>
              {item === "PROMPTS" && hydrated && persisted.prompts.length ? (
                <em>{persisted.prompts.length}</em>
              ) : null}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="cs-save-top"
          onClick={() => {
            setPromptSaveSource(null);
            setSaveDialogOpen(true);
          }}
          disabled={!prompt.trim()}
          aria-label={editingPrompt ? "Prompt aktualisieren" : "Setup speichern"}
        >
          <Save size={16} />
          <span>{editingPrompt ? "Prompt aktualisieren" : "Setup speichern"}</span>
        </button>
      </header>

      {view === "CREATE" ? (
        <main className="cs-create-view">
          <div className="cs-hero">
            <div>
              <span className="cs-eyebrow">Schnell von der Idee zum Bild</span>
              <h1>Was möchtest du erschaffen?</h1>
              <p>
                Lade Referenzen hoch und beschreibe frei, was daraus entstehen soll.
              </p>
            </div>
            <div className="cs-hero__badge">
              <Zap size={16} /> Promptgesteuert
            </div>
          </div>

          <div className="cs-workspace-grid">
            <div className="cs-workspace-main">
              <ReferenceUploader
                references={references}
                missingReferences={missingReferences}
                effectiveLimit={effectiveReferenceLimit}
                modelName={selectedModel.name}
                onAdd={addReferences}
                onRemove={removeReference}
                onRestoreMissing={restoreMissingReference}
                onDismissMissing={(referenceId) =>
                  setMissingReferences((current) =>
                    current.filter(
                      (reference) => reference.referenceId !== referenceId,
                    ),
                  )
                }
                onClear={clearReferences}
                onRoleChange={(id, role) =>
                  setReferences((current) =>
                    current.map((reference) =>
                      reference.id === id ? { ...reference, role } : reference,
                    ),
                  )
                }
              />

              <section className="cs-card cs-prompt-card-main">
                <div className="cs-section-heading">
                  <div>
                    <span className="cs-step">02</span>
                    <div>
                      <h2>Dein Prompt</h2>
                      <p>Beschreibe Motiv, Szene, Stil und den Einsatz der Referenzen.</p>
                    </div>
                  </div>
                  <div className="cs-prompt-heading-actions">
                    <span className="cs-character-count">
                      {prompt.length.toLocaleString("de-DE")} Zeichen
                    </span>
                    <button
                      type="button"
                      className="cs-prompt-save-action"
                      disabled={!prompt.trim()}
                      onClick={() => {
                        setPromptSaveSource(null);
                        setSaveDialogOpen(true);
                      }}
                    >
                      <Save size={14} /> Prompt speichern
                    </button>
                  </div>
                </div>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Zum Beispiel: Erstelle ein fotorealistisches Streetwear-Kampagnenbild. Nutze das Model aus Referenz 1, das Design aus Referenz 2 und die Lichtstimmung aus Referenz 3 …"
                  rows={8}
                  maxLength={12000}
                />
                <div className="cs-prompt-ideas" aria-label="Prompt-Ideen">
                  {PROMPT_IDEAS.map((idea) => (
                    <button
                      type="button"
                      key={idea}
                      onClick={() =>
                        setPrompt((current) =>
                          current.trim() ? `${current.trim()} · ${idea}` : idea,
                        )
                      }
                    >
                      <Plus size={13} /> {idea}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="cs-prompt-clear"
                    onClick={() => setPrompt("")}
                    disabled={!prompt}
                  >
                    <Trash2 size={14} /> Leeren
                  </button>
                </div>
                <div className="cs-output-row" aria-label="Bildtyp">
                  <span>Bildtyp</span>
                  <div>
                    {CREATIVE_OUTPUT_TYPES.map((type) => (
                      <button
                        type="button"
                        key={type}
                        className={outputType === type ? "is-active" : ""}
                        onClick={() => setOutputType(type)}
                      >
                        {CREATIVE_OUTPUT_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="cs-card cs-inline-settings">
                <div>
                  <span className="cs-eyebrow">Schnelleinstellungen</span>
                  <p>Seitenverhältnis, Qualität und Anzahl für diesen Lauf.</p>
                </div>
                <QuickControlButtons
                  aspectRatio={aspectRatio}
                  quality={quality}
                  batchSize={batchSize}
                  supportedQualities={selectedModel.supportedQualities}
                  onAspectRatio={setAspectRatio}
                  onQuality={setQuality}
                  onBatchSize={setBatchSize}
                />
                {selectedModel.availability === "LIVE" ? (
                  <p className="cs-inline-cost">
                    {props.customerMode ? `Credit-Preis: ${customerCredits} Credits · Verfügbar: ${availableCredits.toLocaleString("de-DE")}` : <>Geschätzte Maximalkosten: {estimatedMaximumCostUsd.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "USD",
                    })}</>}
                  </p>
                ) : null}
              </section>
            </div>

            <aside className="cs-workspace-side">
              <ModelSelector
                modelId={modelId}
                open={modelPopoverOpen}
                onOpen={() => setModelPopoverOpen(true)}
                onClose={() => setModelPopoverOpen(false)}
                onChange={changeModel}
              />
              <AdvancedPanel
                open={advancedOpen}
                advanced={advanced}
                onToggle={() => setAdvancedOpen((value) => !value)}
                onChange={setAdvanced}
              />
              <section className="cs-card cs-setup-summary">
                <span className="cs-eyebrow">Aktuelles Setup</span>
                <dl>
                  <div>
                    <dt>Modell</dt>
                    <dd>{selectedModel.name}</dd>
                  </div>
                  <div>
                    <dt>Referenzen</dt>
                    <dd>{references.length || "Keine"}</dd>
                  </div>
                  <div>
                    <dt>Bildtyp</dt>
                    <dd>{CREATIVE_OUTPUT_TYPE_LABELS[outputType]}</dd>
                  </div>
                  <div>
                    <dt>Ausgabe</dt>
                    <dd>
                      {aspectRatio === "AUTO" ? "Auto" : aspectRatio} · {quality} ·{" "}
                      {batchSize}×
                    </dd>
                  </div>
                </dl>
                <p>
                  {selectedModel.availability === "LIVE" &&
                  (props.customerMode
                    ? props.customerConfig?.ready
                    : props.providerConfig?.ready)
                    ? props.customerMode
                      ? `${customerCredits} Credits · ${availableCredits.toLocaleString("de-DE")} verfügbar`
                      : `Live verbunden · geschätzte Maximalkosten ${estimatedMaximumCostUsd.toLocaleString("de-DE", { style: "currency", currency: "USD" })}`
                    : selectedModel.availability === "LIVE"
                      ? "Provider-Adapter verbunden; Serverkonfiguration noch unvollständig."
                    : "Auswahl verfügbar; externe Ausführung ist noch nicht aktiviert."}
                </p>
              </section>
            </aside>
          </div>

          {notice ? (
            <div
              className={`cs-notice cs-notice--${notice.kind.toLowerCase()}`}
              role="status"
            >
              <span>
                {notice.kind === "SUCCESS" ? (
                  <Check size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
              </span>
              <div className="cs-notice__copy">
                <p>{notice.text}</p>
                {notice.details ? (
                  <details>
                    <summary>Technische Details</summary>
                    <code>{notice.details}</code>
                  </details>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Hinweis schließen"
              >
                <X size={15} />
              </button>
            </div>
          ) : null}

          <section className="cs-results" aria-labelledby="cs-results-title">
            <div className="cs-results__heading">
              <div>
                <span className="cs-eyebrow">Deine Kreationen</span>
                <h2 id="cs-results-title">Ergebnisse</h2>
              </div>
              {activeRun?.results.length ? (
                <div className="cs-results__actions">
                  {!props.customerMode ? (
                    <button
                      type="button"
                      className="cs-text-button"
                      onClick={() => void reopenRunSetup(activeRun)}
                    >
                      <RotateCcw size={15} /> Setup erneut öffnen
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="cs-text-button"
                    onClick={() => {
                      setEditingPrompt(null);
                      setPromptSaveSource(activeRun.setup);
                      setSaveDialogOpen(true);
                    }}
                  >
                    <Save size={15} /> Prompt speichern
                  </button>
                </div>
              ) : null}
            </div>
            {activeRun?.results.length ? (
              <div className="cs-results-grid">
                {activeRun.results.map((result) => (
                  <article key={result.id}>
                    <div>
                      <Image
                        src={result.url}
                        alt="Creative-Studio-Ergebnis"
                        fill
                        sizes="(max-width: 760px) 100vw, 33vw"
                        unoptimized
                      />
                    </div>
                    {props.customerMode ? (
                      <footer className="cs-result-actions cs-result-actions--customer">
                        {result.creationId ? (
                          <Link
                            className="cs-result-library"
                            href={`/app/creative-studio?creation=${encodeURIComponent(result.creationId)}&mode=edit`}
                          >
                            <WandSparkles size={16} /> Bild bearbeiten
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="cs-result-library"
                            onClick={() => void addResultAsReference(result)}
                          >
                            <WandSparkles size={16} /> Bild bearbeiten
                          </button>
                        )}
                        <div className="cs-result-secondary-actions">
                          {result.creationId ? (
                            <Link href={`/app/creative-studio?creation=${encodeURIComponent(result.creationId)}&mode=recreate`}>
                              <RotateCcw size={15} /> Neu erstellen
                            </Link>
                          ) : (
                            <button type="button" onClick={() => void reopenRunSetup(activeRun)}>
                              <RotateCcw size={15} /> Neu erstellen
                            </button>
                          )}
                          {result.libraryAssetId ? (
                            <Link href={`/app/ugc-video-studio?libraryAsset=${encodeURIComponent(result.libraryAssetId)}`}>
                              <Zap size={15} /> Video erstellen
                            </Link>
                          ) : null}
                          <details className="cs-result-more">
                            <summary aria-label="Weitere Ergebnisaktionen">
                              <MoreHorizontal size={17} /> Mehr
                            </summary>
                            <div className="cs-result-more__menu">
                              <button
                                type="button"
                                onClick={() => void toggleResultFavorite(result.id)}
                              >
                                <Heart
                                  size={16}
                                  fill={result.favorite ? "currentColor" : "none"}
                                />
                                {result.favorite
                                  ? "Favorit entfernen"
                                  : "Als Favorit markieren"}
                              </button>
                              <a href={result.downloadUrl ?? result.url} download>
                                <Download size={16} /> Herunterladen
                              </a>
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Maximize2 size={16} /> Groß öffnen
                              </a>
                            </div>
                          </details>
                        </div>
                        {result.libraryAssetId ? (
                          <span className="cs-result-library-status">
                            <Check size={14} /> In Bibliothek
                          </span>
                        ) : null}
                      </footer>
                    ) : (
                      <footer>
                        <a href={result.downloadUrl ?? result.url} download>
                          <Download size={15} /> Herunterladen
                        </a>
                        <button
                          type="button"
                          onClick={() => void addResultAsReference(result)}
                        >
                          <ImagePlus size={15} /> Als Referenz
                        </button>
                        <button
                          type="button"
                          aria-label={
                            result.favorite
                              ? "Aus Favoriten entfernen"
                              : "Zu Favoriten hinzufügen"
                          }
                          onClick={() => void toggleResultFavorite(result.id)}
                        >
                          <Heart
                            size={15}
                            fill={result.favorite ? "currentColor" : "none"}
                          />
                        </button>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Ergebnis vergrößern"
                        >
                          <Maximize2 size={15} />
                        </a>
                      </footer>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="cs-results-empty">
                <span>
                  <Sparkles size={25} />
                </span>
                <h3>
                  {generating ? "Deine Bilder werden erstellt" : "Bereit für deine erste Kreation"}
                </h3>
                <p>
                  {generating
                    ? "Nano Banana Pro verarbeitet Prompt und Referenzen. Bitte sende den Auftrag nicht erneut."
                    : selectedModel.availability === "LIVE"
                      ? "Wähle Referenzen, schreibe deinen Prompt und starte die Generierung."
                      : "Ergebnisse erscheinen hier, sobald ein ausgewähltes Modell live verbunden ist. Bis dahin bleibt jeder Klick kostenfrei und ehrlich."}
                </p>
              </div>
            )}
          </section>

          <div className="cs-quick-bar" aria-label="Generieren">
            <button
              type="button"
              className="cs-generate-button"
              onClick={generate}
              disabled={
                !prompt.trim() ||
                generating ||
                tooManyReferences ||
                Boolean(
                  props.customerMode &&
                    (!props.customerConfig?.ready ||
                      insufficientCustomerCredits ||
                      customerConcurrencyReached),
                )
              }
            >
              {generating ? (
                <Loader2 size={19} className="cs-spin" />
              ) : (
                <Sparkles size={19} />
              )}
              <span>{generating ? "Wird vorbereitet …" : props.customerMode ? `Generieren · ${customerCredits} Credits` : "Generieren"}</span>
            </button>
          </div>
        </main>
      ) : view === "PROMPTS" ? (
        <PromptLibrary
          prompts={persisted.prompts}
          onCreate={openCreate}
          onLoad={(saved) => {
            setEditingPrompt(null);
            loadSetup({
              contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
              prompt: saved.prompt,
              modelId: saved.modelId,
              aspectRatio: saved.aspectRatio,
              quality: saved.quality,
              batchSize: saved.batchSize,
              outputType: saved.outputType,
              references: [],
              advanced: saved.advanced ?? { ...DEFAULT_CREATIVE_ADVANCED_SETTINGS },
            });
            persist(
              upsertCreativePrompt(persisted, {
                ...saved,
                lastUsedAt: nowIso(),
                updatedAt: nowIso(),
              }),
            );
          }}
          onEdit={(saved) => {
            setEditingPrompt(saved);
            loadSetup({
              contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
              prompt: saved.prompt,
              modelId: saved.modelId,
              aspectRatio: saved.aspectRatio,
              quality: saved.quality,
              batchSize: saved.batchSize,
              outputType: saved.outputType,
              references: [],
              advanced: saved.advanced ?? { ...DEFAULT_CREATIVE_ADVANCED_SETTINGS },
            });
            setNotice({
              kind: "INFO",
              text: "Bearbeite Prompt oder Einstellungen und wähle anschließend „Prompt aktualisieren“.",
            });
          }}
          onToggleFavorite={(saved) =>
            persist(
              upsertCreativePrompt(persisted, {
                ...saved,
                favorite: !saved.favorite,
                updatedAt: nowIso(),
              }),
            )
          }
          onDuplicate={(saved) =>
            persist(
              upsertCreativePrompt(persisted, {
                ...saved,
                id: createCreativeClientId(),
                title: `${saved.title} – Kopie`,
                favorite: false,
                createdAt: nowIso(),
                updatedAt: nowIso(),
                lastUsedAt: null,
              }),
            )
          }
          onDelete={(id) => persist(removeCreativePrompt(persisted, id))}
        />
      ) : (
        <RunHistory
          runs={persisted.runs}
          onCreate={openCreate}
          onLoad={(run) => {
            setEditingPrompt(null);
            setActiveRun(run);
            void reopenRunSetup(run);
          }}
          onSavePrompt={(run) =>
            savePrompt(
              {
                title: `${CREATIVE_OUTPUT_TYPE_LABELS[run.setup.outputType]} · ${formatGermanDate(run.createdAt)}`,
                description: "Aus dem Creative-Studio-Verlauf gespeichert.",
                tags: [],
              },
              run.setup,
              true,
            )
          }
        />
      )}

      <PromptSaveDialog
        open={saveDialogOpen}
        initialTitle={
          editingPrompt?.title ??
          ((promptSaveSource?.prompt ?? prompt).trim().slice(0, 52) ||
            "Neuer Creative Prompt")
        }
        initialDescription={editingPrompt?.description ?? ""}
        initialTags={editingPrompt?.tags ?? []}
        onClose={() => {
          setSaveDialogOpen(false);
          setPromptSaveSource(null);
        }}
        onSave={(metadata) =>
          savePrompt(
            metadata,
            promptSaveSource ?? undefined,
            promptSaveSource !== null,
          )
        }
      />
    </div>
  );
}
