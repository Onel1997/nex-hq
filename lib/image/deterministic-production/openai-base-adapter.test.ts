import assert from "node:assert/strict";
import test from "node:test";

import { generateOpenAiImage } from "@/agents/image/providers/openai-images-provider";
import type { OpenAiIdentityEditRequest } from "@/agents/image/providers/openai-images-edit-provider";
import type { ImageGenerationRequest } from "@/agents/image/providers/image-provider";

test("OpenAI Stage A adapter sends Product references but no Master Artwork", async () => {
  const captured: OpenAiIdentityEditRequest[] = [];
  const request = {
    prompt: "clean garment base",
    dimensions: "1024x1536",
    assetType: "campaign_primary",
    identity: {
      trace: {} as never,
      masterReference: { assetId: "identity", checksum: "identity-checksum", mimeType: "image/png", bytes: Buffer.from("identity") },
      supportingReferences: [
        {
          role: "front",
          assetId: "identity-front",
          checksum: "identity-front-checksum",
          mimeType: "image/png",
          bytes: Buffer.from("identity-front"),
        },
      ],
      constraints: {
        displayName: "Approved model",
        canonicalIdentityDescription: "same person",
        immutableFeatures: "locked face",
        prohibitedChanges: "identity change",
        approvedHairVariations: "approved only",
        approvedExpressionRange: "neutral",
        approvedBodyProportions: "locked",
        approvedAgeRange: "approved",
        defaultStyling: "controlled",
      },
    },
    production: {
      product: {
        version: "product-production-context-v1",
        productId: "gid://shopify/Product/1",
        variantId: "gid://shopify/ProductVariant/1",
        productName: "Zip Hoodie",
        productType: "Zip Hoodie",
        color: "Black",
        size: "L",
        material: "Cotton",
        fit: "Oversized",
        collection: null,
        availability: "AVAILABLE",
        active: true,
        authority: "SHOPIFY_LIVE",
        authoritative: true,
        provenance: {
          source: "Shopify live",
          sourceRecordId: "variant-1",
          capturedAt: "2026-08-17T12:00:00.000Z",
          sourceVersion: "2026-08-17T11:00:00.000Z",
        },
      },
      productReferences: [{ referenceId: "product-image", role: "FEATURED", mimeType: "image/png", bytes: Buffer.from("product") }],
      shot: { scene: "studio", lighting: "soft", poseDirection: "front", shotTitle: "front" },
    },
  } satisfies ImageGenerationRequest;

  await generateOpenAiImage(request, {
    async editFromMaster(input) {
      captured.push(input);
      return {
        prompt: input.prompt,
        status: "completed",
        providerId: "openai",
        imageBytes: Buffer.from("fake-base"),
        providerRequestId: "fake-request",
        path: "openai.images.edit(gpt-image-1, image=[persona-master,persona-supporting,product-references], input_fidelity=high)",
        inputFidelity: "high",
      };
    },
  });

  const seen = captured[0];
  assert.ok(seen);
  assert.equal(seen.artworkReference, undefined);
  assert.equal(seen.productReferences?.length, 1);
  assert.equal(seen.supportingIdentityReferences?.length, 1);
  assert.deepEqual(
    seen.supportingIdentityReferences?.[0]?.bytes,
    Buffer.from("identity-front"),
  );
  assert.match(seen.prompt, /IDENTITY PRIORITY — NON-NEGOTIABLE/i);
  assert.match(seen.prompt, /highest-priority human-subject constraint/i);
  assert.match(seen.prompt, /Identity fidelity outranks scene novelty/i);
  assert.match(seen.prompt, /no generic casting fallback/i);
  assert.match(seen.prompt, /stable facial geometry and exact relationships/i);
  assert.match(seen.prompt, /Do not choose a location based on ethnicity/i);
  assert.match(seen.prompt, /Product reference images constrain the garment only/i);
  assert.match(seen.prompt, /must never influence the person's face/i);
  assert.match(seen.prompt, /Never infer or alter identity from the scene, location, cultural cues/i);
  assert.match(seen.prompt, /completely blank, plain, solid-color, and unprinted/i);
  assert.match(seen.prompt, /legacy artwork|old prints/i);
  assert.match(seen.prompt, /never reproduce|never copy/i);
  assert.match(seen.prompt, /gently tensioned/i);
  assert.match(seen.prompt, /mild body curvature and fine cloth texture/i);
  assert.match(seen.prompt, /graphic, text, logo, placeholder, watermark, decoration/i);
});
