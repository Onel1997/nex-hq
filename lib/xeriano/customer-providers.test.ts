import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { XerianoCustomerProviders } from "@/components/xeriano/customer-providers";
import { useLocale } from "@/lib/i18n";

function LocaleProbe() {
  return createElement("span", { "data-locale": useLocale() }, "Studio");
}

test("Xeriano customer provider supplies the existing German I18n context", () => {
  const target = globalThis as typeof globalThis & { React?: typeof React };
  const previous = target.React;
  target.React = React;
  try {
    assert.doesNotThrow(() => renderToStaticMarkup(
      createElement(XerianoCustomerProviders, null, createElement(LocaleProbe)),
    ));
    assert.match(
      renderToStaticMarkup(createElement(XerianoCustomerProviders, null, createElement(LocaleProbe))),
      /data-locale="de"/,
    );
  } finally {
    target.React = previous;
  }
});

test("all customer routes share the provider at the app layout boundary", () => {
  const layout = readFileSync("app/(customer)/app/layout.tsx", "utf8");
  for (const route of ["creative-studio", "ugc-video-studio", "design-studio", "library"]) {
    assert.ok(readFileSync(`app/(customer)/app/${route}/page.tsx`, "utf8").length > 0);
  }
  assert.match(layout, /XerianoCustomerProviders/);
  assert.match(layout, /<XerianoCustomerProviders><div className="xeriano-customer-shell">/);
});

test("owner studios retain their existing DashboardShell I18nProvider", () => {
  const dashboardShell = readFileSync("components/layout/dashboard-shell.tsx", "utf8");
  assert.match(dashboardShell, /<I18nProvider>/);
  assert.match(readFileSync("app/(dashboard)/creative-studio/page.tsx", "utf8"), /CreativeStudioWorkspace/);
  assert.match(readFileSync("app/(dashboard)/ugc-video-studio/page.tsx", "utf8"), /UgcVideoStudioWorkspace/);
});

test("hotfix changes no provider or generation runtime source", () => {
  const wrapper = readFileSync("components/xeriano/customer-providers.tsx", "utf8");
  const layout = readFileSync("app/(customer)/app/layout.tsx", "utf8");
  assert.doesNotMatch(wrapper + layout, /providers\/fal|generation-service|nano-banana|seedance|kling|queue|provider payload/i);
});
