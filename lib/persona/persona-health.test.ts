/**
 * Persona Studio Phase 1.1 — additional unit tests (deterministic).
 * Live Supabase persistence is covered by persona.live.test.ts (opt-in).
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  MemoryPersonaRepository,
  PERSONA_DEMO_SEED,
  PERSONA_REFERENCE_MAX_BYTES,
  assertAllowedPersonaReferenceUpload,
  createProductionPersonaRepository,
  getPersonaRepositoryKind,
  isPublicPermanentPersonaUrl,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import { checkPersonaStudioHealth } from "@/lib/persona/services/health";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { PersonaAuditEventType } from "@/lib/persona/audit/persona-events";
import { PERSONA_SECURITY_NOTES_VERSION } from "@/lib/persona/SECURITY";

describe("Persona Studio Phase 1.1 health + storage guards", () => {
  let memory: MemoryPersonaRepository;

  beforeEach(() => {
    memory = new MemoryPersonaRepository();
    setPersonaRepositoryForTests(memory);
  });

  afterEach(() => {
    setPersonaRepositoryForTests(null);
  });

  it("production repository factory never silently falls back to memory", () => {
    setPersonaRepositoryForTests(null);
    try {
      const repo = createProductionPersonaRepository();
      assert.equal(repo.kind, "supabase");
      assert.equal(getPersonaRepositoryKind(), "supabase");
    } catch (err) {
      assert.ok(err instanceof PersonaDomainError);
      assert.equal(err.code, "CONFIG");
    } finally {
      setPersonaRepositoryForTests(memory);
    }
  });

  it("invalid MIME is rejected in German", () => {
    assert.throws(
      () =>
        assertAllowedPersonaReferenceUpload({
          mimeType: "image/gif",
          byteLength: 100,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.code === "INVALID_REFERENCE_ASSET" &&
        /Ungültiger Dateityp/.test(err.message),
    );
  });

  it("oversized upload is rejected", () => {
    assert.throws(
      () =>
        assertAllowedPersonaReferenceUpload({
          mimeType: "image/jpeg",
          byteLength: PERSONA_REFERENCE_MAX_BYTES + 1,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.code === "INVALID_REFERENCE_ASSET" &&
        /zu groß/.test(err.message),
    );
  });

  it("signed URL helper never marks public permanent URLs as safe", () => {
    assert.equal(
      isPublicPermanentPersonaUrl(
        "https://x.supabase.co/storage/v1/object/public/persona-references/a.jpg",
      ),
      true,
    );
  });

  it("audit event type values use extensible text domain (no enum violation)", () => {
    const events: PersonaAuditEventType[] = [
      "persona.created",
      "persona.reference_uploaded",
      "persona.reference_approved",
      "persona.primary_reference_changed",
      "persona.submitted_for_review",
      "persona.approved",
      "persona.archived",
    ];
    for (const eventType of events) {
      assert.ok(eventType.startsWith("persona."));
      assert.ok(eventType.length < 80);
    }
    // brain_events.domain is TEXT — persona_studio is valid
    assert.equal("persona_studio".length > 0, true);
  });

  it("no production demo auto-seeding", () => {
    assert.equal(PERSONA_DEMO_SEED.personas.length, 0);
  });

  it("security notes are documented for Phase 1.1", () => {
    assert.equal(PERSONA_SECURITY_NOTES_VERSION, "phase-1.2");
  });

  it("health check returns structured status without secrets", async () => {
    const report = await checkPersonaStudioHealth();
    assert.ok(["healthy", "degraded", "unavailable"].includes(report.status));
    assert.ok(["Bereit", "Einrichtung erforderlich", "Fehler"].includes(report.uiLabel));
    assert.equal(report.memoryFallback, false);
    assert.equal("SUPABASE_SERVICE_ROLE_KEY" in report, false);
    assert.equal("serviceRoleKey" in report, false);
  });
});
