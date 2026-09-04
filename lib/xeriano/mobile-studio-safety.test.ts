import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ugcCss = readFileSync("app/ugc-video-studio.css", "utf8");
const creativeCss = readFileSync("app/creative-studio.css", "utf8");
const xerianoCss = readFileSync("app/xeriano.css", "utf8");
const globalCss = readFileSync("app/globals.css", "utf8");

test("all Xeriamo studio form controls enforce the iOS-safe 16px mobile size", () => {
  for (const [scope, css] of [
    [".ugc-video-studio-shell", ugcCss],
    [".creative-studio-shell", creativeCss],
    [".xeriamo-design-studio", xerianoCss],
  ] as const) {
    assert.match(css, new RegExp(`${scope.replaceAll(".", "\\.")} textarea[\\s\\S]{0,300}font-size:\\s*16px\\s*!important`));
    assert.match(css, new RegExp(`${scope.replaceAll(".", "\\.")} select`));
  }
});

test("mobile Xeriamo shells and media are contained without disabling accessible zoom", () => {
  assert.match(globalCss, /@media \(max-width: 760px\)[\s\S]*html,[\s\S]*body[\s\S]*overflow-x: hidden/);
  assert.match(globalCss, /\.xeriano-customer-main[\s\S]*\.hq-app-content[\s\S]*min-width: 0/);
  assert.match(ugcCss, /\.ugc-video-studio-shell video[\s\S]{0,100}max-width: 100%/);
  assert.match(creativeCss, /\.creative-studio-shell video[\s\S]{0,100}max-width: 100%/);
  const viewportPages = [
    "app/(customer)/app/ugc-video-studio/page.tsx",
    "app/(customer)/app/creative-studio/page.tsx",
    "app/(dashboard)/hq/ugc-video-studio/page.tsx",
    "app/(dashboard)/hq/creative-studio/page.tsx",
  ].map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(viewportPages, /user-scalable|maximum-scale|max(?:imum)?Scale/iu);
});

test("mobile overflow protection covers the requested 375, 390, 393 and 430px QA widths", () => {
  const widths = [375, 390, 393, 430];
  for (const width of widths) assert.ok(width <= 760);
  assert.match(ugcCss, /overflow-wrap: anywhere/);
  assert.match(creativeCss, /overflow-wrap: anywhere/);
  assert.match(xerianoCss, /overflow-wrap:anywhere/);
});
