import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  productProductionContextSchema,
  resolveProductProductionContext,
} from "./product-production-context";
import type { ShopifyCatalog } from "@/lib/shopify/types";

const liveCatalog: ShopifyCatalog = {
  collections: [],
  products: [
    {
      id: "gid://shopify/Product/zip",
      title: "Milaene Heavy Zip Hoodie",
      handle: "heavy-zip-hoodie",
      status: "ACTIVE",
      productType: "Zip Hoodie",
      tags: [],
      description: "",
      totalInventory: 4,
      imageUrl: null,
      priceMin: "100",
      priceMax: "100",
      currency: "EUR",
      collections: ["Zipper"],
      options: [],
      variantColors: ["Heather Grey"],
      variantSizes: ["L"],
      updatedAt: "2026-08-17T00:00:00.000Z",
      variants: [
        {
          id: "gid://shopify/ProductVariant/zip-grey-l",
          title: "Heather Grey / L",
          sku: "ZIP-GREY-L",
          availableForSale: true,
          inventoryQuantity: 4,
          selectedOptions: [
            { name: "Color", value: "Heather Grey" },
            { name: "Size", value: "L" },
          ],
          updatedAt: "2026-08-17T00:30:00.000Z",
        },
      ],
    },
  ],
};

describe("ProductProductionContext authority", () => {
  it("server-resolves exact Shopify product/variant truth", async () => {
    const context = await resolveProductProductionContext(
      {
        authority: "SHOPIFY_LIVE",
        productId: "gid://shopify/Product/zip",
        variantId: "gid://shopify/ProductVariant/zip-grey-l",
      },
      {
        fetchCatalog: async () => liveCatalog,
        now: () => "2026-08-17T01:00:00.000Z",
      },
    );
    assert.equal(context.authoritative, true);
    assert.equal(context.productType, "Zip Hoodie");
    assert.equal(context.color, "Heather Grey");
    assert.equal(context.size, "L");
    assert.equal(context.availability, "AVAILABLE");
    assert.equal(context.provenance.sourceRecordId, context.variantId);
  });

  it("fails closed for invented Shopify IDs and inactive products", async () => {
    await assert.rejects(
      () =>
        resolveProductProductionContext(
          {
            authority: "SHOPIFY_LIVE",
            productId: "gid://shopify/Product/missing",
            variantId: null,
          },
          { fetchCatalog: async () => liveCatalog },
        ),
      /not found/i,
    );
    const inactive = structuredClone(liveCatalog);
    inactive.products[0].status = "DRAFT";
    await assert.rejects(
      () =>
        resolveProductProductionContext(
          {
            authority: "SHOPIFY_LIVE",
            productId: inactive.products[0].id,
            variantId: null,
          },
          { fetchCatalog: async () => inactive },
        ),
      /not active/i,
    );
  });

  it("keeps Design/Seed/Brain/Unknown visibly non-authoritative", async () => {
    for (const authority of [
      "DESIGN_HANDOFF_LOCAL",
      "SEED",
      "BRAIN",
      "UNKNOWN",
    ] as const) {
      const context = await resolveProductProductionContext({
        authority,
        productId: authority === "SEED" ? "milaene-zip-hoodie" : null,
        variantId: null,
        productName: "Zip Hoodie",
        productType: "zip hoodie",
        color: null,
        size: null,
        material: "heavyweight cotton",
        fit: "oversized",
        collection: null,
        availability: "UNKNOWN",
        active: authority === "SEED" ? true : null,
        provenance: `${authority} test source`,
        sourceVersion: authority === "SEED" ? "seed-1" : null,
        capturedAt: "2026-08-17T01:00:00.000Z",
      });
      assert.equal(context.authoritative, false);
      assert.equal(context.authority, authority);
    }
    assert.throws(
      () =>
        productProductionContextSchema.parse({
          version: "product-production-context-v1",
          productId: "fake",
          variantId: null,
          productName: "Fake live",
          productType: "hoodie",
          color: null,
          size: null,
          material: null,
          fit: null,
          collection: null,
          availability: "UNKNOWN",
          active: null,
          authority: "UNKNOWN",
          authoritative: true,
          provenance: {
            source: "client",
            sourceRecordId: null,
            capturedAt: "2026-08-17T01:00:00.000Z",
            sourceVersion: null,
          },
        }),
      /Only server-verified Shopify-live/i,
    );
  });
});
