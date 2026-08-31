import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadImage } from "canvas";

import { deriveDesignAssetCapabilities } from "@/lib/xeriano/library";
import { isSafePrivateSvg, rasterizePrivateSvgCore } from "@/lib/xeriano/svg-raster-core";

const svg = (width: number, height: number) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect x="0" y="0" width="${width / 2}" height="${height}" fill="#111111"/></svg>`,
);

test("SVG rasterization is deterministic, aspect-safe, 4K and alpha-preserving", async () => {
  const source = svg(300, 400);
  const png = await rasterizePrivateSvgCore(source, { longEdge: 4096, upscale: true });
  const image = await loadImage(png);
  assert.equal(image.width, 3072);
  assert.equal(image.height, 4096);
  assert.deepEqual(
    await rasterizePrivateSvgCore(source, { longEdge: 256, upscale: true }),
    await rasterizePrivateSvgCore(source, { longEdge: 256, upscale: true }),
  );
  const preview = await rasterizePrivateSvgCore(source, { longEdge: 256, upscale: true });
  const decoded = await import("canvas").then(({ createCanvas }) => {
    const canvas = createCanvas(192, 256);
    const context = canvas.getContext("2d");
    return loadImage(preview).then((loaded) => {
      context.drawImage(loaded, 0, 0);
      return context.getImageData(180, 128, 1, 1).data;
    });
  });
  assert.equal(decoded[3], 0);
});

test("SVG safety rejects active and externally loaded content", () => {
  assert.equal(isSafePrivateSvg(svg(100, 100)), true);
  assert.equal(isSafePrivateSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), false);
  assert.equal(isSafePrivateSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://outside.example/a.png"/></svg>')), false);
  assert.equal(isSafePrivateSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://outside.example/a.svg)"/></svg>')), false);
});

test("SVG-to-PNG route is free, account-scoped, provider-free and persists provenance", async () => {
  const route = await readFile(new URL("../../app/api/design-studio/svg-to-png/route.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("./svg-to-png.ts", import.meta.url), "utf8");
  const projection = await readFile(new URL("./projection.ts", import.meta.url), "utf8");
  assert.match(route, /requireXerianoAccount/);
  assert.match(service, /\.eq\("id", assetId\)[\s\S]*\.eq\("account_id", context\.accountId\)[\s\S]*\.eq\("asset_type", "DESIGN"\)/);
  assert.match(service, /mime_type !== "image\/svg\+xml"/);
  assert.match(service, /isSafePrivateSvg/);
  assert.doesNotMatch(route, /reserveCustomerGeneration|quoteDesign|FalDesign|providerCost|onAccepted/);
  assert.match(projection, /derived_from_asset_id: input\.sourceAssetId, operation: input\.operation/);
  assert.match(projection, /mime_type: "image\/png"/);
  assert.match(projection, /SVG_TO_PNG_VERSION/);
});

test("original SVG download remains byte-preserving while UI makes formats explicit", async () => {
  const contentRoute = await readFile(new URL("../../app/api/xeriano/library/[assetId]/content/route.ts", import.meta.url), "utf8");
  const designUi = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  const globalLibrary = await readFile(new URL("../../components/xeriano/library-grid.tsx", import.meta.url), "utf8");
  assert.match(contentRoute, /let bytes = Uint8Array\.from\(originalBytes\)/);
  assert.match(contentRoute, /mimeType === "image\/svg\+xml" \? "svg"/);
  assert.match(contentRoute, /Content-Disposition/);
  for (const source of [designUi, globalLibrary]) {
    assert.match(source, /SVG herunterladen/);
    assert.match(source, /PNG-Version erstellen/);
  }
  assert.match(designUi, /setDerivedLabel\("PNG-Version"\)/);
  assert.match(designUi, /setNotice\("PNG-Version erstellt"\)/);
});

test("trusted capabilities offer conversion only for SVG and raster utilities only for derived PNG", () => {
  const original = deriveDesignAssetCapabilities({
    assetType: "DESIGN", mimeType: "image/svg+xml", width: null, height: null, operation: null,
  });
  assert.deepEqual(original, {
    transparentPreview: false, canBackgroundRemove: false, canUpscale: false, canCreatePng: true,
  });
  const derived = deriveDesignAssetCapabilities({
    assetType: "DESIGN", mimeType: "image/png", width: 3072, height: 4096, operation: "SVG_TO_PNG",
  });
  assert.deepEqual(derived, {
    transparentPreview: true, canBackgroundRemove: true, canUpscale: false, canCreatePng: false,
  });
});
