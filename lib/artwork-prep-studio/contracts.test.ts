import assert from "node:assert/strict";
import test from "node:test";
import { createCanvas } from "canvas";
import { inspectArtworkBytes, renderArtworkBackground } from "./image";
import { recommendedArtworkUpscaleFactor } from "./contracts";
import { buildDesignUtilityProviderInput } from "../design-studio/utility-config";
import { readPngMetadata } from "../design-studio/png-metadata";
import { renderDesignPrintFile } from "../design-studio/print-file-render";

test("Artwork Prep validates raster signatures, dimensions, alpha and safe limits", async () => {
  const canvas = createCanvas(120, 80);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 120, 80);
  context.fillStyle = "#000";
  context.fillRect(10, 10, 70, 40);
  const png = canvas.toBuffer("image/png");
  const inspected = await inspectArtworkBytes({ bytes: png, mimeType: "image/png" });
  assert.deepEqual({ width: inspected.width, height: inspected.height, alpha: inspected.hasAlpha, transparent: inspected.hasTransparency }, { width: 120, height: 80, alpha: true, transparent: true });
  await assert.rejects(inspectArtworkBytes({ bytes: Buffer.from("not-png"), mimeType: "image/png" }), /Dateisignatur/);
});

test("colored background is local, proportional and does not mutate source", async () => {
  const canvas = createCanvas(64, 32);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 64, 32);
  context.fillStyle = "#ffffff";
  context.fillRect(8, 8, 20, 12);
  const source = canvas.toBuffer("image/png");
  const before = Buffer.from(source);
  const output = await renderArtworkBackground({ bytes: source, mimeType: "image/png", color: "#F4EFE4" });
  assert.equal(Buffer.compare(source, before), 0);
  assert.equal(output.metadata.width, 64);
  assert.equal(output.metadata.height, 32);
  assert.equal(output.metadata.hasTransparency, false);
});

test("colored print background can preserve the 300-PPI metadata", async () => {
  const canvas = createCanvas(32, 48);
  canvas.getContext("2d").fillRect(8, 8, 12, 20);
  const output = await renderArtworkBackground({ bytes: canvas.toBuffer("image/png"), mimeType: "image/png", color: "#000000", resolution: 300 });
  const metadata = readPngMetadata(output.bytes);
  assert.equal(metadata.pixelsPerMeterX, 11_811);
  assert.equal(metadata.pixelsPerMeterY, 11_811);
});

test("2x and 4x ESRGAN contracts are explicit while existing 2x default is unchanged", () => {
  const url = "https://safe.example/art.png";
  assert.deepEqual(buildDesignUtilityProviderInput({ operation: "UPSCALE", imageUrl: url }), {
    endpoint: "fal-ai/esrgan", payload: { image_url: url, model: "RealESRGAN_x2plus", scale: 2, face: false, output_format: "png", tile: 0 },
  });
  assert.equal(buildDesignUtilityProviderInput({ operation: "UPSCALE", imageUrl: url, upscaleFactor: 4 }).payload.scale, 4);
  assert.equal(recommendedArtworkUpscaleFactor(2_000, 2_500), 4);
  assert.equal(recommendedArtworkUpscaleFactor(4_500, 6_000), null);
});

test("reused print renderer emits exact 4500x6000, 300-PPI pHYs, sRGB and alpha", async () => {
  const source = createCanvas(20, 20);
  source.getContext("2d").fillRect(2, 2, 16, 16);
  const output = await renderDesignPrintFile({ bytes: source.toBuffer("image/png"), mimeType: "image/png" });
  const metadata = readPngMetadata(output);
  assert.equal(metadata.width, 4_500);
  assert.equal(metadata.height, 6_000);
  assert.equal(metadata.pixelsPerMeterX, 11_811);
  assert.equal(metadata.pixelsPerMeterY, 11_811);
  assert.equal(metadata.srgbRenderingIntent, 0);
  assert.equal(metadata.hasAlphaChannel, true);
});
