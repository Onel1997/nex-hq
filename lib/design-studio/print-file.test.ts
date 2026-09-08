import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCanvas } from "canvas";

import {
  PRINT_FILE_DPI,
  PRINT_FILE_HEIGHT,
  PRINT_FILE_WIDTH,
} from "./print-file-contracts";
import { assertTransparentPng, PNG_300_DPI_PIXELS_PER_METER, readPngMetadata } from "./png-metadata";
import { isRasterPrintUpscaleRequired, renderDesignPrintFile, resolvePrintPlacement } from "./print-file-render";

test("print placement preserves aspect ratio, centers artwork and keeps a safe margin", () => {
  const landscape = resolvePrintPlacement(2_000, 1_000);
  assert.deepEqual(landscape, { width: 4_050, height: 2_025, left: 225, top: 1_988 });
  assert.equal(landscape.width / landscape.height, 2);
  const portrait = resolvePrintPlacement(1_000, 2_000);
  assert.deepEqual(portrait, { width: 2_700, height: 5_400, left: 900, top: 300 });
  assert.equal(portrait.width / portrait.height, 0.5);
  assert.equal(isRasterPrintUpscaleRequired(1_000, 2_000), true);
  assert.equal(isRasterPrintUpscaleRequired(4_500, 6_000), false);
});

test("real print PNG is exactly 4500x6000, standard 300 DPI, explicit sRGB and transparent", async () => {
  const source = createCanvas(40, 20);
  const context = source.getContext("2d");
  context.fillStyle = "#ff2255";
  context.fillRect(0, 0, 40, 20);
  const output = await renderDesignPrintFile({ bytes: source.toBuffer("image/png"), mimeType: "image/png" });
  const metadata = readPngMetadata(output);
  assert.equal(metadata.width, PRINT_FILE_WIDTH);
  assert.equal(metadata.height, PRINT_FILE_HEIGHT);
  assert.equal(metadata.pixelsPerMeterX, PNG_300_DPI_PIXELS_PER_METER);
  assert.equal(metadata.pixelsPerMeterY, PNG_300_DPI_PIXELS_PER_METER);
  assert.equal(metadata.resolutionUnit, 1);
  assert.equal(metadata.srgbRenderingIntent, 0);
  assert.ok(Math.abs(metadata.pixelsPerMeterX! / 39.37007874 - PRINT_FILE_DPI) < 0.002);
  await assert.doesNotReject(() => assertTransparentPng(output));
});

test("safe SVG remains available as source and renders proportionally onto the print canvas", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><path fill="#111" d="M0 0h20v10H0z"/></svg>');
  const output = await renderDesignPrintFile({ bytes: svg, mimeType: "image/svg+xml" });
  const metadata = readPngMetadata(output);
  assert.equal(metadata.width, PRINT_FILE_WIDTH);
  assert.equal(metadata.height, PRINT_FILE_HEIGHT);
  await assert.doesNotReject(() => assertTransparentPng(output));
});

test("print route is explicit POST, returns metadata only and keeps account-scoped source validation", async () => {
  const route = await readFile(new URL("../../app/api/design-studio/print-file/route.ts", import.meta.url), "utf8");
  const recoveryRoute = await readFile(new URL("../../app/api/design-studio/print-file/jobs/[jobId]/route.ts", import.meta.url), "utf8");
  const ui = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  const service = await readFile(new URL("./print-file.ts", import.meta.url), "utf8");
  const projection = await readFile(new URL("./projection.ts", import.meta.url), "utf8");
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.match(route, /persistDesignUtilityResult/);
  assert.doesNotMatch(route, /queue\.submit|FalDesignProvider|reserveCustomerGeneration/);
  assert.match(service, /\.eq\("id", assetId\)[\s\S]*\.eq\("account_id", context\.accountId\)[\s\S]*\.eq\("asset_type", "DESIGN"\)/);
  assert.match(projection, /PRINT_FILE_OPERATION/);
  assert.match(projection, /resolution_dpi: 300/);
  assert.match(projection, /color_space: "sRGB"/);
  assert.match(recoveryRoute, /SupabaseDesignPrintFileStore/);
  assert.doesNotMatch(recoveryRoute, /renderDesignPrintFile|executeDesignPrintFile|queue\.submit/);
  assert.match(ui, /fetchDesignPrintFileJob/);
  assert.match(ui, /PRINT_FILE_JOB_KEY_PREFIX/);
  assert.match(ui, /300-PPI-Druckformat/);
  assert.match(ui, /Rasterquelle wurde hochskaliert/);
  assert.match(projection, /raster_source_upscaled/);
});

test("print claim precedes rendering and an existing identity returns without rerendering", async () => {
  const service = await readFile(new URL("./print-file.ts", import.meta.url), "utf8");
  assert.ok(service.indexOf("await store.claim") < service.indexOf("await renderDesignPrintFile"));
  assert.match(service, /if \(claim === "EXISTS"\)[\s\S]*return \{ manifest: existing, bytes: null \}/);
  assert.doesNotMatch(service, /queue\.submit|reserveCustomerGeneration|providerRequestId/);
});
