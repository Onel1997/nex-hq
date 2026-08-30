import assert from "node:assert/strict";
import test from "node:test";

import {
  ownerFacingProductionError,
  resolveOwnerProductionState,
} from "@/lib/image/deterministic-v2-panel/owner-production-state";

const base = {
  busy: false,
  actionPhase: null,
  prepareStatus: "ready",
  recoveryState: null,
  jobStatus: null,
  reviewStatus: null,
  recoveredContinuation: false,
  duplicateClickIgnored: false,
  hasError: false,
} as const;

test("owner state machine exposes truthful durable production phases", () => {
  assert.equal(
    resolveOwnerProductionState({
      ...base,
      busy: true,
      actionPhase: "confirming",
    }).title,
    "Auftrag wird bestätigt …",
  );
  assert.equal(
    resolveOwnerProductionState({
      ...base,
      recoveryState: "BASE_RUNNING",
      jobStatus: "running",
    }).title,
    "Basisbild wird erstellt …",
  );
  assert.match(
    resolveOwnerProductionState({
      ...base,
      recoveryState: "BASE_RUNNING",
      jobStatus: "running",
    }).detail,
    /Kleidungsstück wird erkannt/,
  );
  assert.equal(
    resolveOwnerProductionState({
      ...base,
      recoveryState: "BASE_READY",
      jobStatus: "running",
    }).title,
    "Kleidungsstück erkannt. Artwork wird angewendet …",
  );
  assert.equal(
    resolveOwnerProductionState({
      ...base,
      recoveryState: "COMPOSITING",
      jobStatus: "running",
    }).title,
    "Artwork wird auf das Produkt angewendet …",
  );
  assert.equal(
    resolveOwnerProductionState({
      ...base,
      recoveryState: "SAVING_RESULT",
      jobStatus: "running",
    }).title,
    "Ergebnis wird gespeichert …",
  );
  assert.equal(
    resolveOwnerProductionState({
      ...base,
      reviewStatus: "REVIEW_REQUIRED",
    }).title,
    "Ergebnis ist zur Prüfung bereit.",
  );
});

test("continuation is shown only for a recovered confirmed job", () => {
  assert.equal(
    resolveOwnerProductionState({
      ...base,
      recoveryState: "CONFIRMED",
      jobStatus: "confirmed",
    }).showContinuation,
    false,
  );
  const recovered = resolveOwnerProductionState({
    ...base,
    recoveryState: "CONFIRMED",
    jobStatus: "confirmed",
    recoveredContinuation: true,
  });
  assert.equal(recovered.showContinuation, true);
  assert.match(recovered.detail, /wiederhergestellt/);
});

test("duplicate click and unknown outcome never suggest a second provider attempt", () => {
  const running = resolveOwnerProductionState({
    ...base,
    recoveryState: "BASE_RUNNING",
    jobStatus: "running",
    duplicateClickIgnored: true,
  });
  assert.match(running.detail, /läuft bereits/);
  const unknown = resolveOwnerProductionState({
    ...base,
    recoveryState: "UNKNOWN_PROVIDER_OUTCOME",
    jobStatus: "unknown_outcome",
  });
  assert.equal(unknown.showContinuation, false);
  assert.match(unknown.detail, /keinen zweiten/);
});

test("technical failures map to concise German owner messages", () => {
  assert.equal(
    ownerFacingProductionError(
      "Der gewählte große Frontprint konnte auf diesem Bild nicht in der gewünschten Größe sicher erhalten werden.",
    ),
    "Der gewählte große Frontprint konnte auf diesem Bild nicht in der gewünschten Größe sicher erhalten werden.",
  );
  assert.match(
    ownerFacingProductionError("BASE_PRINT_ZONE_CONTAMINATED"),
    /fremder Aufdruck/,
  );
  assert.match(
    ownerFacingProductionError("input fingerprint mismatch"),
    /nicht mehr aktuell/,
  );
  assert.match(
    ownerFacingProductionError("GARMENT_REGISTRATION_LOW_CONFIDENCE"),
    /nicht sicher erkannt/,
  );
  assert.equal(
    ownerFacingProductionError("GARMENT_REGISTRATION_LARGE_FRONT_UNSAFE"),
    "Der gewählte große Frontprint konnte auf diesem Bild nicht sicher innerhalb der tatsächlichen Shirt-Frontfläche erhalten werden.",
  );
  assert.equal(
    ownerFacingProductionError("GARMENT_REGISTRATION_FRONT_TORSO_UNSAFE"),
    "Die Front-Druckfläche konnte auf diesem Bild nicht zuverlässig auf den Shirt-Torso begrenzt werden.",
  );
  assert.match(
    ownerFacingProductionError("BRAND_MODEL_IDENTITY_MISMATCH"),
    /nicht sicher genug.*Markenmodel/i,
  );
  assert.match(
    ownerFacingProductionError("SURFACE_INTEGRATION_UNSAFE"),
    /Falten, Licht und Stoffoberfläche/,
  );
  assert.equal(
    ownerFacingProductionError("DEPTH_AWARE_SURFACE_UNSAFE"),
    "Das Artwork konnte nicht sicher an Perspektive, Körperneigung und Stoffoberfläche angepasst werden. Es wurde kein Ergebnis zur Freigabe erstellt.",
  );
  assert.equal(
    ownerFacingProductionError("SURFACE_REALISM_REFINEMENT_UNSAFE"),
    "Das Artwork konnte nicht sicher stärker an Perspektive, Stoffrichtung und Shirt-Oberfläche angepasst werden. Es wurde kein Ergebnis zur Freigabe erstellt.",
  );
  assert.equal(
    ownerFacingProductionError(
      "Das Artwork konnte in dieser Druckfläche nicht ohne Verzerrung oder Beschnitt platziert werden.",
    ),
    "Das Artwork konnte in dieser Druckfläche nicht ohne Verzerrung oder Beschnitt platziert werden.",
  );
  assert.doesNotMatch(
    ownerFacingProductionError("raw internal provider failure"),
    /raw internal/,
  );
});
