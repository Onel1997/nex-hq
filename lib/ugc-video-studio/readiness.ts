import type { UgcVideoMode, UgcVideoReferenceMedia } from "@/lib/ugc-video-studio/contracts";

export type UgcGenerateReadinessCode =
  | "GENERATING"
  | "ACTIVE_JOB"
  | "PROMPT_REQUIRED"
  | "PROMPT_TOO_LONG"
  | "VIDEO_REQUIRED"
  | "CHARACTER_MASTER_REQUIRED"
  | "START_IMAGE_REQUIRED"
  | "REFERENCES_UPLOADING"
  | "REFERENCE_UPLOAD_FAILED"
  | "DURATION_INVALID"
  | "ASPECT_INVALID"
  | "RESOLUTION_INVALID"
  | "AUDIO_INVALID"
  | "MODEL_UNAVAILABLE"
  | "PRICE_UPDATING"
  | "INSUFFICIENT_CREDITS"
  | "CONCURRENCY_REACHED"
  | "READY";

export type UgcGenerateReadiness = {
  ready: boolean;
  code: UgcGenerateReadinessCode;
  label: string;
};

export function resolveUgcGenerateReadiness(input: {
  mode: UgcVideoMode;
  generating: boolean;
  activeJobRunning: boolean;
  promptPresent: boolean;
  promptAllowed?: boolean;
  sourceVideoPresent: boolean;
  characterMasterPresent: boolean;
  startImageRequired?: boolean;
  startImagePresent?: boolean;
  references: ReadonlyArray<Pick<UgcVideoReferenceMedia, "uploadState">>;
  durationAllowed: boolean;
  aspectAllowed?: boolean;
  resolutionAllowed?: boolean;
  audioAllowed?: boolean;
  customerMode: boolean;
  ownerMode: boolean;
  customerModelUnavailable: boolean;
  ownerModelUnavailable?: boolean;
  customerCredits: number | null;
  insufficientCustomerCredits: boolean;
  customerConcurrencyReached: boolean;
  ownerEstimateUsd: number | null;
}): UgcGenerateReadiness {
  if (input.generating) {
    return { ready: false, code: "GENERATING", label: "Video wird erstellt …" };
  }
  if (input.activeJobRunning) {
    return { ready: false, code: "ACTIVE_JOB", label: "Laufender Auftrag wird geprüft …" };
  }
  if (input.mode === "MOTION_CONTROL" && !input.promptPresent) {
    return { ready: false, code: "PROMPT_REQUIRED", label: "Prompt hinzufügen" };
  }
  if (input.mode === "BASE_VIDEO" && !input.promptPresent) {
    return { ready: false, code: "PROMPT_REQUIRED", label: "Prompt hinzufügen" };
  }
  if (input.mode === "VIDEO_RECAST" && !input.promptPresent) {
    return { ready: false, code: "PROMPT_REQUIRED", label: "Prompt hinzufügen" };
  }
  if (input.mode === "BASE_VIDEO" && input.promptAllowed === false) {
    return { ready: false, code: "PROMPT_TOO_LONG", label: "Prompt ist zu lang" };
  }
  if (input.mode === "VIDEO_EDIT" && !input.sourceVideoPresent) {
    return { ready: false, code: "VIDEO_REQUIRED", label: "Quellvideo hinzufügen" };
  }
  if (input.mode === "VIDEO_EDIT" && !input.characterMasterPresent) {
    return { ready: false, code: "CHARACTER_MASTER_REQUIRED", label: "Model / Mockup hinzufügen" };
  }
  if (input.mode === "VIDEO_RECAST" && !input.sourceVideoPresent) {
    return { ready: false, code: "VIDEO_REQUIRED", label: "Quellvideo hinzufügen" };
  }
  if (input.mode === "VIDEO_RECAST" && !input.characterMasterPresent) {
    return { ready: false, code: "CHARACTER_MASTER_REQUIRED", label: "Model / Outfit hinzufügen" };
  }
  if (
    input.mode === "BASE_VIDEO" &&
    input.startImageRequired &&
    !input.startImagePresent
  ) {
    return { ready: false, code: "START_IMAGE_REQUIRED", label: "Startbild erforderlich" };
  }
  if (input.references.some((reference) => reference.uploadState === "FAILED")) {
    return { ready: false, code: "REFERENCE_UPLOAD_FAILED", label: "Upload fehlgeschlagen" };
  }
  if (input.references.some((reference) => reference.uploadState !== "READY")) {
    return { ready: false, code: "REFERENCES_UPLOADING", label: input.mode === "BASE_VIDEO" ? "Startbild wird vorbereitet …" : "Referenzen werden vorbereitet …" };
  }
  if (!input.durationAllowed) {
    return { ready: false, code: "DURATION_INVALID", label: input.mode === "BASE_VIDEO" ? "Ausgewählte Dauer wird nicht unterstützt" : "Videolänge prüfen" };
  }
  if (input.aspectAllowed === false) {
    return { ready: false, code: "ASPECT_INVALID", label: "Ausgewähltes Format wird nicht unterstützt" };
  }
  if (input.resolutionAllowed === false) {
    return { ready: false, code: "RESOLUTION_INVALID", label: "Auflösung prüfen" };
  }
  if (input.audioAllowed === false) {
    return { ready: false, code: "AUDIO_INVALID", label: "Audioeinstellung prüfen" };
  }
  if (input.customerMode && input.customerModelUnavailable) {
    return { ready: false, code: "MODEL_UNAVAILABLE", label: "Modell nicht verfügbar" };
  }
  if (input.ownerMode && input.ownerModelUnavailable) {
    return { ready: false, code: "MODEL_UNAVAILABLE", label: "Modell nicht verfügbar" };
  }
  if (input.customerMode && input.customerCredits === null) {
    return { ready: false, code: "PRICE_UPDATING", label: "Preis wird aktualisiert …" };
  }
  if (input.ownerMode && input.ownerEstimateUsd === null) {
    return { ready: false, code: "PRICE_UPDATING", label: "Preis wird aktualisiert …" };
  }
  if (input.customerMode && input.insufficientCustomerCredits) {
    return { ready: false, code: "INSUFFICIENT_CREDITS", label: "Nicht genügend Credits" };
  }
  if (input.customerMode && input.customerConcurrencyReached) {
    return { ready: false, code: "CONCURRENCY_REACHED", label: "Aktiven Auftrag zuerst abschließen" };
  }
  return { ready: true, code: "READY", label: "Generieren" };
}
