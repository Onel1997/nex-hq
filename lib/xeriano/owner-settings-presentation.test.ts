import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveOwnerSettingsPresentation } from "./owner-settings-presentation";

test("Owner Settings derives safe integration presence without serializing authority values", () => {
  const presentation = resolveOwnerSettingsPresentation({
    VERCEL_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://wwfezmywxishfgwnijyd.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-secret-value",
    SUPABASE_SERVICE_ROLE_KEY: "service-secret-value",
    FAL_KEY: "fal-secret-value",
    STRIPE_SECRET_KEY: "stripe-secret-value",
    STRIPE_WEBHOOK_SECRET: "webhook-secret-value",
    OPENAI_API_KEY: "openai-secret-value",
  });

  assert.equal(presentation.environmentLabel, "Private Beta · Staging");
  assert.equal(presentation.integrations.every((item) => item.configured), true);
  const serialized = JSON.stringify(presentation);
  assert.doesNotMatch(serialized, /secret-value|SUPABASE|FAL_KEY|STRIPE_SECRET|OPENAI_API_KEY/);
});

test("Owner Settings shows unavailable services without environment-file instructions", () => {
  const presentation = resolveOwnerSettingsPresentation({});
  assert.equal(presentation.integrations.every((item) => !item.configured), true);

  const page = readFileSync("app/(dashboard)/settings/page.tsx", "utf8");
  const panels = readFileSync("components/settings/settings-panels.tsx", "utf8");
  const visibleSettings = page + panels;
  assert.match(visibleSettings, /Xeriamo Owner Workspace/);
  assert.match(visibleSettings, /Logo, Icon und Favicon verwalten/);
  assert.match(visibleSettings, /action=\{logoutOwner\}/);
  assert.doesNotMatch(visibleSettings, /\.env\.local|OPENAI_API_KEY|gpt-4o|LangGraph|Instagram/);
});

test("Owner logout uses the existing Supabase sign-out authority and redirects to login", () => {
  const action = readFileSync("app/auth-actions.ts", "utf8");
  const desktop = readFileSync("components/navigation/hq-sidebar.tsx", "utf8");
  const mobile = readFileSync("components/navigation/studio-mobile-navigation.tsx", "utf8");
  const settings = readFileSync("components/settings/settings-panels.tsx", "utf8");

  assert.match(action, /supabase\.auth\.signOut\(\)/);
  assert.match(action, /redirect\("\/login"\)/);
  for (const surface of [desktop, mobile, settings]) {
    assert.match(surface, /action=\{logoutOwner\}/);
    assert.match(surface, /Abmelden/);
  }
});

test("Owner Settings mobile layout remains bounded at supported iPhone widths", () => {
  const css = readFileSync("app/hq-navigation.css", "utf8");
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /calc\(2rem \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /min-height: 44px/);

  for (const viewport of [375, 390, 414, 430]) {
    assert.ok(viewport >= 375 && viewport <= 430);
  }
});
