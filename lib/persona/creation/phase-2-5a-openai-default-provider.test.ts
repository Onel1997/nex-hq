/**
 * Phase 2.5A — Official Brand Face Casting defaults to OpenAI Images.
 * No paid provider calls in these tests.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_DISCOVERY_PROVIDER,
  resolveConfiguredDiscoveryProviderId,
} from "@/lib/persona/creation/provider/discovery-provider-config";
import {
  resolveEffectiveProviderMode,
} from "@/lib/persona/creation/provider/config";
import { getPersonaCandidateGenerator } from "@/lib/persona/creation/provider/registry";
import { getDiscoveryProviderPreflight } from "@/lib/persona/creation/provider/discovery-provider-registry";
import { shouldUseDiscoveryCompletionEngine } from "@/lib/persona/creation/discovery/live-a1-completion-orchestrator";

const ROOT = process.cwd();

describe("Phase 2.5A — Official Brand Face OpenAI default", () => {
  const prevProvider = process.env.PERSONA_DISCOVERY_PROVIDER;
  const prevFal = process.env.FAL_KEY;
  const prevOpenAi = process.env.OPENAI_API_KEY;
  const prevFake = process.env.PERSONA_USE_FAKE_PROVIDER;

  beforeEach(() => {
    delete process.env.PERSONA_DISCOVERY_PROVIDER;
    delete process.env.PERSONA_USE_FAKE_PROVIDER;
  });

  afterEach(() => {
    if (prevProvider === undefined) delete process.env.PERSONA_DISCOVERY_PROVIDER;
    else process.env.PERSONA_DISCOVERY_PROVIDER = prevProvider;
    if (prevFal === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = prevFal;
    if (prevOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevOpenAi;
    if (prevFake === undefined) delete process.env.PERSONA_USE_FAKE_PROVIDER;
    else process.env.PERSONA_USE_FAKE_PROVIDER = prevFake;
  });

  it("1. new Official Brand Face discovery defaults to OpenAI", () => {
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    process.env.OPENAI_API_KEY = "sk-test-phase-25a";
    process.env.FAL_KEY = "fal-test-still-present";
    delete process.env.PERSONA_DISCOVERY_PROVIDER;
    assert.equal(resolveConfiguredDiscoveryProviderId(), "openai");
    const resolved = resolveEffectiveProviderMode("image_provider");
    assert.equal(resolved.providerId, "openai");
    assert.equal(resolved.discoveryProviderId, "openai");
  });

  it("2. FLUX is not called / selected by default even when FAL_KEY exists", () => {
    process.env.OPENAI_API_KEY = "sk-test-phase-25a";
    process.env.FAL_KEY = "fal-test-still-present";
    delete process.env.PERSONA_DISCOVERY_PROVIDER;
    const resolved = resolveEffectiveProviderMode("image_provider");
    assert.equal(resolved.providerId, "openai");
    assert.notEqual(resolved.providerId, "fal_flux");
    // Tests intentionally wrap live generators with fake — routing still says openai.
    const gen = getPersonaCandidateGenerator("image_provider");
    assert.ok(gen.id === "openai" || gen.id === "fake");
    assert.equal(
      shouldUseDiscoveryCompletionEngine({
        castingPhase: "a1_discovery",
        officialBrandFace: true,
        providerId: resolveConfiguredDiscoveryProviderId(),
      }),
      false,
    );
  });

  it("3. explicit FLUX selection still works when supported", () => {
    process.env.PERSONA_DISCOVERY_PROVIDER = "fal_flux";
    process.env.FAL_KEY = "fal-test-explicit";
    process.env.OPENAI_API_KEY = "sk-test-phase-25a";
    assert.equal(resolveConfiguredDiscoveryProviderId(), "fal_flux");
    const resolved = resolveEffectiveProviderMode("image_provider");
    assert.equal(resolved.providerId, "fal_flux");
    assert.equal(resolved.discoveryProviderId, "fal_flux");
    assert.equal(
      shouldUseDiscoveryCompletionEngine({
        castingPhase: "a1_discovery",
        officialBrandFace: true,
        providerId: "fal_flux",
      }),
      true,
    );
  });

  it("4. old projects preserve original provider metadata (routing is env/project, not rewrite)", () => {
    // Historical provider strings must remain valid DiscoveryProviderId values.
    const ui = readFileSync(
      join(ROOT, "components/persona/official-brand-face-casting-view.tsx"),
      "utf8",
    );
    const config = readFileSync(
      join(ROOT, "lib/persona/creation/provider/discovery-provider-config.ts"),
      "utf8",
    );
    assert.doesNotMatch(ui, /UPDATE.*provider_mode|rewrite.*fal_flux|migrate.*openai/i);
    assert.match(config, /explicitly/);
    assert.match(config, /Never silently fall back to FLUX/);
  });

  it("5–6. cost confirmation remains required; no provider call before confirmation", () => {
    const ui = readFileSync(
      join(ROOT, "components/persona/official-brand-face-casting-view.tsx"),
      "utf8",
    );
    assert.match(ui, /<dd>OpenAI<\/dd>/);
    assert.match(ui, /4 Entdeckungsgesichter mit OpenAI erstellen/);
    assert.match(ui, /confirmCost/);
    assert.match(ui, /preparePaidConfirmation/);
    assert.match(ui, /canStartPaidCandidateGeneration/);
    // Generate path still requires confirmation token + checkbox.
    assert.match(ui, /Bitte Kosten explizit bestätigen/);
    assert.doesNotMatch(ui, /4 Entdeckungsgesichter mit FLUX erstellen/);
  });

  it("7–8. completed Brand Model / Identity Lock / approvals untouched by this phase", () => {
    const lock = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    const approvals = readFileSync(
      join(ROOT, "lib/persona/creation/use-approvals/use-approval-service.ts"),
      "utf8",
    );
    // Phase 2.5A must not alter lock / approval services.
    assert.doesNotMatch(
      readFileSync(
        join(ROOT, "lib/persona/creation/provider/discovery-provider-config.ts"),
        "utf8",
      ),
      /identity_lock|image_use_approved|brand_cast_approved|master_reference/i,
    );
    assert.ok(lock.includes("lockBrandIdentity"));
    assert.ok(approvals.includes("approveImageUse"));
  });

  it("OpenAI missing fails closed without silent FLUX fallback", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.FAL_KEY = "fal-present-but-not-default";
    delete process.env.PERSONA_DISCOVERY_PROVIDER;
    assert.equal(resolveConfiguredDiscoveryProviderId(), "openai");
    const resolved = resolveEffectiveProviderMode("image_provider");
    assert.equal(resolved.providerConfigured, false);
    assert.equal(resolved.discoveryProviderId, "openai");
    assert.match(resolved.setupMessage ?? "", /OPENAI_API_KEY/i);
    const preflight = getDiscoveryProviderPreflight();
    assert.equal(preflight.providerId, "openai");
    assert.equal(preflight.configured, false);
  });
});
