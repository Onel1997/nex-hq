import assert from "node:assert/strict";
import test from "node:test";
import { MemoryProductProfileRepository } from "./memory-repository";
import { assessManualProductEligibility, createManualProductProfile, addManualProductReference, saveProductPrintSurface, updateProductKnowledge } from "./service";

const scope = { workspaceId: "11111111-1111-4111-8111-111111111111", actorId: "owner-1" };
const quad = [{ x: .3, y: .25 }, { x: .7, y: .25 }, { x: .68, y: .72 }, { x: .32, y: .72 }] as const;
const deps = (repository: MemoryProductProfileRepository) => ({ repository, now: () => "2026-08-17T20:00:00.000Z", id: () => "profile-1" });

test("Manual Product is durable, Shopify-independent, and preserves unknown truth", async () => {
  const repository = new MemoryProductProfileRepository();
  const profile = await createManualProductProfile(scope, { name: "Heavy Jogger", productType: "Jogger", status: "SAMPLE", colorways: ["Schwarz"], sizes: ["M", "L"], construction: { material: "Baumwolle", gsm: 420, fit: "Baggy" } }, deps(repository));
  assert.equal(profile.authority, "MANUAL_PROFILE");
  assert.equal(profile.shopifyProductId, null);
  assert.equal(profile.active, null);
  assert.equal(profile.available, null);
  assert.equal(profile.variants.length, 2);
  assert.equal((profile as unknown as { artwork?: unknown }).artwork, undefined);
  assert.equal((profile as unknown as { persona?: unknown }).persona, undefined);
});

test("Manual Product eligibility fails closed until frozen reference and calibrated Jogger surface exist", async () => {
  const repository = new MemoryProductProfileRepository();
  let profile = await createManualProductProfile(scope, { name: "Heavy Jogger", productType: "Jogger", status: "SAMPLE", colorways: ["Schwarz"], construction: {} }, deps(repository));
  assert.equal(assessManualProductEligibility(profile, profile.variants[0]!.variantId, "left-leg").eligible, false);
  profile = await addManualProductReference(scope, profile.productProfileId, { expectedVersion: profile.version, role: "FRONT", bytes: Buffer.from("fixture"), mimeType: "image/png" }, { ...deps(repository), id: () => "ref-1", storeManualReference: async ({ workspaceId, productProfileId }) => ({ path: `workspace/${workspaceId}/product-profiles/${productProfileId}/fixture.png`, checksum: "a".repeat(64), mimeType: "image/png" as const, byteLength: 7, width: 100, height: 100 }) });
  profile = await saveProductPrintSurface(scope, profile.productProfileId, { expectedVersion: profile.version, printSurfaceId: "left-leg", displayName: "Linkes Bein", region: "left_leg", variantId: profile.variants[0]!.variantId, surfaceKind: "PRINT", supportedPrintMethods: ["DTF"], quad, calibrationAttestation: true }, deps(repository));
  const result = assessManualProductEligibility(profile, profile.variants[0]!.variantId, "left-leg");
  assert.equal(result.eligible, true);
  assert.equal(result.selectedSurface?.region, "left_leg");
});

test("Product versions keep historical production metadata immutable", async () => {
  const repository = new MemoryProductProfileRepository();
  const v1 = await createManualProductProfile(scope, { name: "Zip Hoodie", productType: "Zip Hoodie", status: "SAMPLE", colorways: ["Schwarz"], construction: { zipper: "Metall" } }, deps(repository));
  const v2 = await updateProductKnowledge(scope, v1.productProfileId, { expectedVersion: 1, construction: { gsm: 460, hood: "Doppellagig", pockets: ["Seitentaschen"] } }, deps(repository));
  assert.equal(v2.version, 2);
  assert.equal(v2.construction.gsm, 460);
  assert.equal((await repository.getVersion(scope, v1.productProfileId, 1))?.construction.gsm, null);
});

test("workspace isolation rejects Product reads", async () => {
  const repository = new MemoryProductProfileRepository();
  const profile = await createManualProductProfile(scope, { name: "Jacket", productType: "Jacket", status: "DRAFT", colorways: ["Schwarz"], construction: {} }, deps(repository));
  const other = { workspaceId: "22222222-2222-4222-8222-222222222222", actorId: "owner-2" };
  assert.equal(await repository.getLatest(other, profile.productProfileId), null);
});
