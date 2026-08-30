import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDefaultGarmentSize } from "@/lib/image/product-size-default";

describe("Image Studio default garment size resolver", () => {
  it("prefers L for oversized garments when available", () => {
    assert.equal(
      resolveDefaultGarmentSize({
        availableSizes: ["S", "M", "L", "XL"],
        garmentFamilyLabel: "Heavy Oversized Tee",
        productType: "T-Shirt",
      }),
      "L",
    );
  });

  it("falls back to M when L is unavailable", () => {
    assert.equal(
      resolveDefaultGarmentSize({
        availableSizes: ["S", "M", "XL"],
        garmentFamilyLabel: "Heavy Oversized Tee",
        productType: "T-Shirt",
      }),
      "M",
    );
  });

  it("uses M for non-oversized garments", () => {
    assert.equal(
      resolveDefaultGarmentSize({
        availableSizes: ["S", "M", "L"],
        garmentFamilyLabel: "Regular Tee",
        productType: "T-Shirt",
      }),
      "M",
    );
  });

  it("never fabricates unavailable sizes", () => {
    assert.equal(
      resolveDefaultGarmentSize({
        availableSizes: ["XL", "XXL"],
        garmentFamilyLabel: "Heavy Oversized Tee",
        productType: "T-Shirt",
      }),
      "XL",
    );
    assert.equal(
      resolveDefaultGarmentSize({
        availableSizes: [],
        garmentFamilyLabel: "Heavy Oversized Tee",
        productType: "T-Shirt",
      }),
      null,
    );
  });

  it("honours a future Brand Model preferredGarmentSize when available", () => {
    assert.equal(
      resolveDefaultGarmentSize({
        availableSizes: ["S", "M", "L"],
        garmentFamilyLabel: "Heavy Oversized Tee",
        productType: "T-Shirt",
        modelPreference: { preferredGarmentSize: "M" },
      }),
      "M",
    );
  });
});
