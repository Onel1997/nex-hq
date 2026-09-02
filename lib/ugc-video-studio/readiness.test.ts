import assert from "node:assert/strict";
import test from "node:test";

import { resolveUgcGenerateReadiness } from "@/lib/ugc-video-studio/readiness";
import { quoteXerianoCredits } from "@/lib/xeriano/pricing";

const readyInput = {
  mode: "VIDEO_EDIT" as const,
  generating: false,
  activeJobRunning: false,
  promptPresent: false,
  sourceVideoPresent: true,
  characterMasterPresent: true,
  references: [{ uploadState: "READY" as const }, { uploadState: "READY" as const }],
  durationAllowed: true,
  customerMode: false,
  ownerMode: true,
  customerModelUnavailable: false,
  customerCredits: null,
  insufficientCustomerCredits: false,
  customerConcurrencyReached: false,
  ownerEstimateUsd: 0.63,
};

test("ready references and an authoritative price enable Generate immediately", () => {
  assert.deepEqual(resolveUgcGenerateReadiness(readyInput), {
    ready: true,
    code: "READY",
    label: "Generieren",
  });
});

test("every disabled Generate state exposes a truthful reason", () => {
  const cases = [
    [{ generating: true }, "GENERATING", "Video wird erstellt …"],
    [{ activeJobRunning: true }, "ACTIVE_JOB", "Laufender Auftrag wird geprüft …"],
    [{ sourceVideoPresent: false }, "VIDEO_REQUIRED", "Quellvideo hinzufügen"],
    [{ characterMasterPresent: false }, "CHARACTER_MASTER_REQUIRED", "Model / Mockup hinzufügen"],
    [{ references: [{ uploadState: "UPLOADING" as const }] }, "REFERENCES_UPLOADING", "Referenzen werden vorbereitet …"],
    [{ references: [{ uploadState: "FAILED" as const }] }, "REFERENCE_UPLOAD_FAILED", "Upload fehlgeschlagen"],
    [{ durationAllowed: false }, "DURATION_INVALID", "Videolänge prüfen"],
    [{ ownerEstimateUsd: null }, "PRICE_UPDATING", "Preis wird aktualisiert …"],
  ] as const;
  for (const [change, code, label] of cases) {
    const readiness = resolveUgcGenerateReadiness({ ...readyInput, ...change });
    assert.equal(readiness.ready, false);
    assert.equal(readiness.code, code);
    assert.equal(readiness.label, label);
  }
});

test("customer financial and concurrency blockers stay explicit", () => {
  const customerInput = {
    ...readyInput,
    customerMode: true,
    ownerMode: false,
    customerCredits: 125,
    ownerEstimateUsd: null,
  };
  const cases = [
    [{ customerModelUnavailable: true }, "MODEL_UNAVAILABLE", "Modell nicht verfügbar"],
    [{ customerCredits: null }, "PRICE_UPDATING", "Preis wird aktualisiert …"],
    [{ insufficientCustomerCredits: true }, "INSUFFICIENT_CREDITS", "Nicht genügend Credits"],
    [{ customerConcurrencyReached: true }, "CONCURRENCY_REACHED", "Aktiven Auftrag zuerst abschließen"],
  ] as const;
  for (const [change, code, label] of cases) {
    const readiness = resolveUgcGenerateReadiness({ ...customerInput, ...change });
    assert.equal(readiness.ready, false);
    assert.equal(readiness.code, code);
    assert.equal(readiness.label, label);
  }
});

test("Motion Control keeps its prompt requirement", () => {
  const missingPrompt = resolveUgcGenerateReadiness({
    ...readyInput,
    mode: "MOTION_CONTROL",
    promptPresent: false,
  });
  assert.equal(missingPrompt.code, "PROMPT_REQUIRED");
  assert.equal(missingPrompt.label, "Prompt hinzufügen");
});

test("model quote changes synchronously and does not depend on prompt text", () => {
  const o3 = quoteXerianoCredits({
    modelId: "kling-o3-pro-video-edit",
    durationSeconds: 5,
  });
  const o1 = quoteXerianoCredits({
    modelId: "kling-o1-standard-video-edit",
    durationSeconds: 5,
  });
  const seedance = quoteXerianoCredits({
    modelId: "seedance-2-fast-video-edit",
    durationSeconds: 5,
  });
  assert.notEqual(o3, o1);
  assert.ok(seedance > 0);
  assert.deepEqual(readyInput.references.map((reference) => reference.uploadState), ["READY", "READY"]);
});

test("OWNER BASE_VIDEO readiness is truthful for prompt, start image and preparation", () => {
  const base = {
    ...readyInput,
    mode: "BASE_VIDEO" as const,
    promptPresent: true,
    promptAllowed: true,
    sourceVideoPresent: false,
    characterMasterPresent: false,
    references: [] as Array<{ uploadState: "READY" | "UPLOADING" | "FAILED" }>,
    startImageRequired: false,
    startImagePresent: false,
    aspectAllowed: true,
    resolutionAllowed: true,
    audioAllowed: true,
    ownerModelUnavailable: false,
    ownerEstimateUsd: 0.25,
  };
  assert.equal(resolveUgcGenerateReadiness(base).code, "READY");
  assert.equal(resolveUgcGenerateReadiness({ ...base, promptPresent: false }).label, "Prompt hinzufügen");
  assert.equal(resolveUgcGenerateReadiness({ ...base, startImageRequired: true }).label, "Startbild erforderlich");
  assert.equal(resolveUgcGenerateReadiness({ ...base, references: [{ uploadState: "UPLOADING" }] }).label, "Startbild wird vorbereitet …");
  assert.equal(resolveUgcGenerateReadiness({ ...base, durationAllowed: false }).label, "Ausgewählte Dauer wird nicht unterstützt");
  assert.equal(resolveUgcGenerateReadiness({ ...base, aspectAllowed: false }).label, "Ausgewähltes Format wird nicht unterstützt");
  assert.equal(resolveUgcGenerateReadiness({ ...base, promptAllowed: false }).code, "PROMPT_TOO_LONG");
});
