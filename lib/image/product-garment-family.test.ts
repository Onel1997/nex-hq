import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isShotCompatible, normalizeProductShotKind } from "@/lib/image/content-packs";
import {
  deriveGarmentFamilyKey,
  extractGarmentPhraseFromTitle,
  formatGarmentFamilySecondaryLabel,
  groupShopifyProductsIntoGarmentFamilies,
  listSizesForGarmentFamilyColor,
  normalizeGarmentFamilyLabel,
  resolveShopifyVariantForGarmentSelection,
  type ShopifyGarmentCatalogProduct,
} from "@/lib/image/product-garment-family";

function variant(id: string, color: string, size: string, availableForSale = true) {
  return {
    id,
    title: `${color} / ${size}`,
    availableForSale,
    selectedOptions: [
      { name: "Color", value: color },
      { name: "Size", value: size },
    ],
  };
}

function shopifyProduct(input: {
  id: string;
  title: string;
  productType: string;
  vendor?: string;
  tags?: string[];
  variants: ReturnType<typeof variant>[];
}): ShopifyGarmentCatalogProduct {
  return {
    id: input.id,
    title: input.title,
    productType: input.productType,
    vendor: input.vendor ?? null,
    tags: input.tags ?? [],
    active: true,
    variantColors: [...new Set(input.variants.map((entry) => entry.selectedOptions[0]!.value))],
    variantSizes: [...new Set(input.variants.map((entry) => entry.selectedOptions[1]!.value))],
    variants: input.variants,
  };
}

describe("Image Studio garment family normalization", () => {
  it("collapses design-specific Shopify titles into one physical garment family", () => {
    const products = [
      shopifyProduct({
        id: "gid://shopify/Product/1",
        title: "Flashbacks - Heavy Oversized Tee",
        productType: "T-Shirt",
        variants: [variant("gid://shopify/ProductVariant/1", "Schwarz", "L")],
      }),
      shopifyProduct({
        id: "gid://shopify/Product/2",
        title: "Faith Oversized Tee",
        productType: "Heavy Oversized Tee",
        variants: [variant("gid://shopify/ProductVariant/2", "Schwarz", "M")],
      }),
      shopifyProduct({
        id: "gid://shopify/Product/3",
        title: "Cruising - Heavy Oversized Tee",
        productType: "T-Shirt",
        variants: [variant("gid://shopify/ProductVariant/3", "Weiß", "L")],
      }),
    ];

    const families = groupShopifyProductsIntoGarmentFamilies(products);
    assert.equal(families.length, 1);
    assert.equal(families[0]?.label, "Heavy Oversized Tee");
    assert.deepEqual(families[0]?.productIds.sort(), [
      "gid://shopify/Product/1",
      "gid://shopify/Product/2",
      "gid://shopify/Product/3",
    ]);
  });

  it("does not infer garment identity from artwork or design-only prefixes alone", () => {
    assert.equal(
      extractGarmentPhraseFromTitle("Quiet Ascent Hero"),
      null,
    );
    assert.equal(
      normalizeGarmentFamilyLabel("Flashbacks - Heavy Oversized Tee", "T-Shirt"),
      "Heavy Oversized Tee",
    );
    assert.notEqual(
      deriveGarmentFamilyKey("Flashbacks - Heavy Oversized Tee", "T-Shirt"),
      deriveGarmentFamilyKey("Dream Zip Hoodie", "Zip Hoodie"),
    );
  });

  it("lists available colors from exact Shopify variants", () => {
    const products = [
      shopifyProduct({
        id: "gid://shopify/Product/10",
        title: "Cruising - Heavy Oversized Tee",
        productType: "T-Shirt",
        variants: [
          variant("gid://shopify/ProductVariant/10", "Schwarz", "L"),
          variant("gid://shopify/ProductVariant/11", "Weiß", "M"),
        ],
      }),
    ];
    const [family] = groupShopifyProductsIntoGarmentFamilies(products);
    assert.ok(family);
    assert.deepEqual(family.colors, ["Schwarz", "Weiß"]);
  });

  it("resolves the exact Shopify product and variant after Product + Color + Size", () => {
    const products = [
      shopifyProduct({
        id: "gid://shopify/Product/20",
        title: "Flashbacks - Heavy Oversized Tee",
        productType: "T-Shirt",
        variants: [variant("gid://shopify/ProductVariant/20", "Schwarz", "L")],
      }),
      shopifyProduct({
        id: "gid://shopify/Product/21",
        title: "Faith Oversized Tee",
        productType: "Heavy Oversized Tee",
        variants: [variant("gid://shopify/ProductVariant/21", "Schwarz", "M")],
      }),
    ];
    const [family] = groupShopifyProductsIntoGarmentFamilies(products);
    assert.ok(family);

    const resolved = resolveShopifyVariantForGarmentSelection({
      products,
      family,
      color: "Schwarz",
      size: "L",
    });
    assert.deepEqual(resolved, {
      productId: "gid://shopify/Product/20",
      variantId: "gid://shopify/ProductVariant/20",
    });
  });

  it("shows supplier only as secondary information", () => {
    const [family] = groupShopifyProductsIntoGarmentFamilies([
      shopifyProduct({
        id: "gid://shopify/Product/30",
        title: "Cruising - Heavy Oversized Tee",
        productType: "T-Shirt",
        vendor: "MarketPrint",
        variants: [variant("gid://shopify/ProductVariant/30", "Schwarz", "L")],
      }),
    ]);
    assert.ok(family);
    assert.equal(family.label, "Heavy Oversized Tee");
    assert.equal(
      formatGarmentFamilySecondaryLabel(family),
      "MarketPrint · Shopify verifiziert",
    );
  });

  it("uses normalized garment family for content-pack compatibility", () => {
    const label = normalizeGarmentFamilyLabel(
      "Flashbacks - Heavy Oversized Tee",
      "T-Shirt",
    );
    assert.equal(normalizeProductShotKind(label), "TSHIRT");
    assert.equal(isShotCompatible("content:clean-front", label), true);
    assert.equal(isShotCompatible("content:zip-open-front", label), false);
  });

  it("derives exact sizes per selected color without fabricating unavailable sizes", () => {
    const products = [
      shopifyProduct({
        id: "gid://shopify/Product/40",
        title: "Cruising - Heavy Oversized Tee",
        productType: "T-Shirt",
        variants: [
          variant("gid://shopify/ProductVariant/40", "Schwarz", "L"),
          variant("gid://shopify/ProductVariant/41", "Schwarz", "XL"),
          variant("gid://shopify/ProductVariant/42", "Weiß", "M"),
        ],
      }),
    ];
    const [family] = groupShopifyProductsIntoGarmentFamilies(products);
    assert.ok(family);
    assert.deepEqual(
      listSizesForGarmentFamilyColor(products, family, "Schwarz"),
      ["L", "XL"],
    );
    assert.equal(
      resolveShopifyVariantForGarmentSelection({
        products,
        family,
        color: "Schwarz",
        size: "S",
      }),
      null,
    );
  });
});
