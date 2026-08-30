import assert from "node:assert/strict";
import test from "node:test";
import { createCanvas } from "canvas";

import { fingerprintImageGenerationInput } from "@/lib/image/paid-generation/fingerprint";
import { MemoryProductProfileRepository } from "@/lib/product-library/memory-repository";
import {
  defaultOwnerArtworkPlacement,
  resolveProductFamilyReadiness,
  resolveGeneratedGarmentRelativeQuad,
  resolveOwnerArtworkQuad,
  selectStageAProductReferences,
} from "@/lib/product-library/product-family";
import { detectMarketPrintGreenArea } from "@/lib/product-library/product-family-green-detection";
import {
  addManualProductReference,
  addProductFamilyColor,
  correctProductFamilyPlacement,
  createManualProductProfile,
  saveProductFamilyPlacementOverlay,
} from "@/lib/product-library/service";

const scope = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  actorId: "owner-1",
};

function overlayPng() {
  const canvas = createCanvas(400, 500);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ececec";
  context.fillRect(0, 0, 400, 500);
  context.fillStyle = "#20242a";
  context.fillRect(80, 40, 240, 420);
  context.fillStyle = "#198b48";
  context.fillRect(120, 110, 160, 260);
  context.strokeStyle = "#54ef89";
  context.lineWidth = 4;
  context.strokeRect(120, 110, 160, 260);
  return canvas.toBuffer("image/png");
}

function ids() {
  let value = 0;
  return () => `id-${++value}`;
}

test("Product Family owns colors and one Front/Back calibration applies to all colors", async () => {
  const repository = new MemoryProductProfileRepository();
  const id = ids();
  const deps = {
    repository,
    id,
    now: () => "2026-08-20T20:00:00.000Z",
    storeManualReference: async ({ bytes, mimeType }: { bytes: Buffer; mimeType: string }) => ({
      path: `${scope.workspaceId}/product-references/manual/family/${id()}.png`,
      checksum: "a".repeat(64),
      mimeType,
      byteLength: bytes.length,
      width: 400,
      height: 500,
    }),
  };
  let profile = await createManualProductProfile(
    scope,
    {
      name: "Vacancy T-Shirt",
      productType: "T-Shirt",
      status: "ACTIVE",
      colorways: [],
      sizes: ["M", "L"],
      productFamily: { enabled: true, supplierName: "MarketPrint" },
    },
    deps,
  );
  assert.equal(profile.productFamily?.supplierName, "MarketPrint");
  for (const colorName of ["Babyblau", "Schwarz", "Weiß"]) {
    profile = await addProductFamilyColor(
      scope,
      profile.productProfileId,
      { expectedVersion: profile.version, colorName },
      deps,
    );
  }
  assert.deepEqual(profile.productFamily?.colors.map((color) => color.colorName), ["Babyblau", "Schwarz", "Weiß"]);
  assert.equal(profile.variants.length, 6);
  assert.equal(resolveProductFamilyReadiness(profile).ready, false);

  for (const side of ["FRONT", "BACK"] as const) {
    const saved = await saveProductFamilyPlacementOverlay(
      scope,
      profile.productProfileId,
      { expectedVersion: profile.version, side, bytes: overlayPng(), mimeType: "image/png" },
      deps,
    );
    profile = saved.profile;
    assert.equal(saved.template.status, "DRAFT");
    const confirmed = await correctProductFamilyPlacement(
      scope,
      profile.productProfileId,
      {
        expectedVersion: profile.version,
        side,
        normalizedRegion: saved.template.normalizedRegion,
      },
      deps,
    );
    profile = confirmed.profile;
    assert.equal(confirmed.template.status, "READY");
  }
  assert.equal(profile.productFamily?.placementTemplates.length, 2);
  assert.ok(profile.productFamily?.placementTemplates.every((template) => template.appliesTo === "ALL_COLORS"));
  assert.equal(profile.printSurfaces.length, 2);
  assert.equal(resolveProductFamilyReadiness(profile).ready, false);
  assert.ok(profile.references.filter((reference) => reference.purpose === "PRINT_AREA_CALIBRATION").every((reference) => reference.providerEligible === false));

  const corrected = await correctProductFamilyPlacement(
    scope,
    profile.productProfileId,
    {
      expectedVersion: profile.version,
      side: "FRONT",
      normalizedRegion: { x: 0.25, y: 0.2, width: 0.5, height: 0.55 },
    },
    deps,
  );
  assert.equal(corrected.template.detection, "OWNER_CORRECTED");
  assert.equal(corrected.template.version, 3);
});

test("failed green detection keeps a private draft for visual manual correction", async () => {
  const repository = new MemoryProductProfileRepository();
  const id = ids();
  const deps = {
    repository,
    id,
    now: () => "2026-08-20T20:00:00.000Z",
    storeManualReference: async ({ bytes, mimeType }: { bytes: Buffer; mimeType: string }) => ({
      path: `${scope.workspaceId}/product-references/manual/family/${id()}.png`,
      checksum: "c".repeat(64), mimeType, byteLength: bytes.length, width: 400, height: 500,
    }),
  };
  let profile = await createManualProductProfile(scope, {
    name: "Vacancy T-Shirt", productType: "T-Shirt", status: "ACTIVE", colorways: ["Babyblau"], sizes: [], productFamily: { enabled: true, supplierName: "MarketPrint" },
  }, deps);
  const plain = createCanvas(400, 500);
  plain.getContext("2d").fillStyle = "#dddddd";
  plain.getContext("2d").fillRect(0, 0, 400, 500);
  const uploaded = await saveProductFamilyPlacementOverlay(scope, profile.productProfileId, {
    expectedVersion: profile.version,
    side: "FRONT",
    bytes: plain.toBuffer("image/png"),
    mimeType: "image/png",
  }, deps);
  profile = uploaded.profile;
  assert.equal(uploaded.template.detection, "MANUAL_REQUIRED");
  assert.equal(uploaded.template.status, "DRAFT");
  assert.equal(profile.printSurfaces.length, 0);
  assert.equal(profile.references.at(-1)?.providerEligible, false);
});

test("MarketPrint green rectangle is detected locally and normalized", async () => {
  const area = await detectMarketPrintGreenArea(overlayPng());
  assert.ok(Math.abs(area.x - 0.3) < 0.02);
  assert.ok(Math.abs(area.y - 0.22) < 0.02);
  assert.ok(Math.abs(area.width - 0.4) < 0.03);
  assert.ok(Math.abs(area.height - 0.52) < 0.03);
  assert.ok(area.x >= 0 && area.y >= 0 && area.x + area.width <= 1 && area.y + area.height <= 1);
});

test("blank exact-color reference wins and green overlay can never reach Stage A", () => {
  const profile = {
    productFamily: {
      colors: [{ colorName: "Babyblau", colorKey: "babyblau" }],
    },
    references: [
      { referenceId: "shopify-print", purpose: "PRODUCT_REFERENCE", providerEligible: true },
      { referenceId: "overlay", purpose: "PRINT_AREA_CALIBRATION", providerEligible: false },
      { referenceId: "blank-front", purpose: "BLANK_PRODUCT", providerEligible: true, familyColorKey: "babyblau", productSide: "FRONT" },
      { referenceId: "blank-back", purpose: "BLANK_PRODUCT", providerEligible: true, familyColorKey: "babyblau", productSide: "BACK" },
    ],
  } as never;
  const selected = selectStageAProductReferences({ profile, color: "Babyblau", side: "FRONT" });
  assert.deepEqual(selected.map((reference) => reference.referenceId), ["blank-front"]);
  assert.equal(selected.some((reference) => reference.purpose === "PRINT_AREA_CALIBRATION"), false);
});

test("Artwork placement stays contained, uniformly scaled and fingerprint-critical", () => {
  const template = { templateId: "family:vacancy:front", version: 1 };
  const placement = defaultOwnerArtworkPlacement(template);
  const quad = resolveOwnerArtworkQuad({
    printableArea: { x: 0.2, y: 0.15, width: 0.6, height: 0.6 },
    artworkWidth: 1200,
    artworkHeight: 600,
    referenceWidth: 1000,
    referenceHeight: 1000,
    placement,
  });
  const width = quad[1].x - quad[0].x;
  const height = quad[3].y - quad[0].y;
  assert.ok(Math.abs(width / height - 2) < 1e-9);
  assert.ok(quad.every((point) => point.x >= 0.2 && point.x <= 0.8 && point.y >= 0.15 && point.y <= 0.75));

  const moved = { ...placement, offsetX: 0.5 };
  const first = fingerprintImageGenerationInput({ productFamilyPlacement: placement } as never);
  const second = fingerprintImageGenerationInput({ productFamilyPlacement: moved } as never);
  assert.notEqual(first, second);
  const generated = resolveGeneratedGarmentRelativeQuad({ productType: "T-Shirt", side: "FRONT", placement });
  assert.ok(generated);
  assert.ok(generated!.every((point) => point.y >= 0.36));
});

test("blank uploads are color/side bound and remain independent of Artwork", async () => {
  const repository = new MemoryProductProfileRepository();
  const id = ids();
  let storedCount = 0;
  const deps = {
    repository,
    id,
    now: () => "2026-08-20T20:00:00.000Z",
    storeManualReference: async ({ bytes, mimeType }: { bytes: Buffer; mimeType: string }) => ({
      path: `${scope.workspaceId}/product-references/manual/family/${id()}.png`,
      checksum: String(++storedCount).repeat(64), mimeType, byteLength: bytes.length, width: 400, height: 500,
    }),
  };
  let profile = await createManualProductProfile(scope, {
    name: "Vacancy T-Shirt", productType: "T-Shirt", status: "ACTIVE", colorways: ["Babyblau"], sizes: [], productFamily: { enabled: true, supplierName: null },
  }, deps);
  const colorKey = profile.productFamily!.colors[0]!.colorKey;
  profile = await addManualProductReference(scope, profile.productProfileId, {
    expectedVersion: profile.version,
    role: "FRONT",
    bytes: overlayPng(),
    mimeType: "image/png",
    purpose: "BLANK_PRODUCT",
    familyColorKey: colorKey,
    productSide: "FRONT",
  }, deps);
  const blank = profile.references.find((reference) => reference.purpose === "BLANK_PRODUCT");
  assert.equal(blank?.familyColorKey, colorKey);
  assert.equal(blank?.providerEligible, true);
  assert.equal("artwork" in profile, false);
  assert.equal(resolveProductFamilyReadiness(profile).ready, false);
  profile = await addManualProductReference(scope, profile.productProfileId, {
    expectedVersion: profile.version,
    role: "FRONT",
    bytes: overlayPng(),
    mimeType: "image/png",
    purpose: "BLANK_PRODUCT",
    familyColorKey: colorKey,
    productSide: "FRONT",
  }, deps);
  const currentBlanks = profile.references.filter(
    (reference) =>
      reference.purpose === "BLANK_PRODUCT" &&
      reference.familyColorKey === colorKey &&
      reference.productSide === "FRONT",
  );
  assert.equal(currentBlanks.length, 1);
  assert.equal(currentBlanks[0]?.contentChecksumSha256, "2".repeat(64));
  const uploaded = await saveProductFamilyPlacementOverlay(
    scope,
    profile.productProfileId,
    {
      expectedVersion: profile.version,
      side: "FRONT",
      bytes: overlayPng(),
      mimeType: "image/png",
    },
    deps,
  );
  const confirmed = await correctProductFamilyPlacement(
    scope,
    profile.productProfileId,
    {
      expectedVersion: uploaded.profile.version,
      side: "FRONT",
      normalizedRegion: uploaded.template.normalizedRegion,
    },
    deps,
  );
  assert.equal(resolveProductFamilyReadiness(confirmed.profile).ready, true);
  assert.equal(
    resolveProductFamilyReadiness({
      ...confirmed.profile,
      status: "DRAFT",
    }).ready,
    false,
  );
  assert.equal(
    resolveProductFamilyReadiness({
      ...confirmed.profile,
      productType: "Other",
    }).ready,
    false,
  );
});
