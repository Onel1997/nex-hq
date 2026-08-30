import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("customer and owner Creative routes share the exact studio stylesheet", () => {
  const owner = read("app/(dashboard)/creative-studio/page.tsx");
  const customer = read("app/(customer)/app/creative-studio/page.tsx");
  assert.match(owner, /import "@\/app\/creative-studio\.css"/);
  assert.match(customer, /import "@\/app\/creative-studio\.css"/);
  assert.match(customer, /CreativeStudioWorkspace/);
  assert.match(customer, /customerMode/);
  assert.match(customer, /viewportFit: "cover"/);
  assert.match(customer, /interactiveWidget: "resizes-content"/);
});

test("customer and owner UGC routes share the exact studio stylesheet", () => {
  const owner = read("app/(dashboard)/ugc-video-studio/page.tsx");
  const customer = read("app/(customer)/app/ugc-video-studio/page.tsx");
  assert.match(owner, /import "@\/app\/ugc-video-studio\.css"/);
  assert.match(customer, /import "@\/app\/ugc-video-studio\.css"/);
  assert.match(customer, /UgcVideoStudioWorkspace/);
  assert.match(customer, /customerMode/);
  assert.match(customer, /viewportFit: "cover"/);
  assert.match(customer, /interactiveWidget: "resizes-content"/);
});

test("customer composition preserves desktop and mobile fixed-CTA offsets", () => {
  const xeriano = read("app/xeriano.css");
  assert.match(
    xeriano,
    /\.xeriano-embedded-studio:has\(\.creative-studio-shell\)\{--cs-sidebar-offset:230px\}/,
  );
  assert.match(
    xeriano,
    /\.xeriano-embedded-studio:has\(\.ugc-video-studio-shell\)\{--uv-sidebar-offset:230px\}/,
  );
  assert.match(xeriano, /@media\(max-width:900px\)/);
  assert.match(xeriano, /--cs-sidebar-offset:0px/);
  assert.match(xeriano, /--uv-sidebar-offset:0px/);
});

test("existing mobile studio styles retain safe-area, compact and overflow behavior", () => {
  const creative = read("app/creative-studio.css");
  const ugc = read("app/ugc-video-studio.css");
  for (const css of [creative, ugc]) {
    assert.match(css, /@media \(max-width: 900px\)/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    assert.match(css, /overflow-x: (?:hidden|clip)/);
  }
  assert.match(creative, /\.cs-quick-bar/);
  assert.match(creative, /\.cs-generate-button/);
  assert.match(ugc, /\.uv-generate-bar/);
  assert.match(ugc, /\.uv-generate/);
});

test("Xeriano customer CSS does not introduce unscoped studio control overrides", () => {
  const xeriano = read("app/xeriano.css");
  assert.doesNotMatch(xeriano, /(?:^|})\s*(?:button|input|textarea|section|h1|h2|main|article)\s*\{/m);
  assert.match(xeriano, /\.xeriano-customer-shell/);
  assert.match(xeriano, /\.xeriano-customer-sidebar/);
});

test("customer provider and credit labels remain present after CSS composition fix", () => {
  const layout = read("app/(customer)/app/layout.tsx");
  const creative = read("components/creative-studio/creative-studio-workspace.tsx");
  const ugc = read("components/ugc-video-studio/ugc-video-studio-workspace.tsx");
  assert.match(layout, /XerianoCustomerProviders/);
  assert.match(creative, /Generieren ·[\s\S]*Credits/);
  assert.match(ugc, /Generieren ·[\s\S]*Credits/);
});
