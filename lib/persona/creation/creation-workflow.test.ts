import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import type { PersonaCreationProject } from "../domain/creation-types";
import {
  canPreparePaidConfirmation,
  evaluatePreparePaidConfirmationGate,
} from "./creation-workflow";

function draftImageProviderProject(
  overrides: Partial<PersonaCreationProject> = {},
): PersonaCreationProject {
  return {
    id: "proj-test-001",
    workspace_id: "ws-1",
    name: "Test Cast",
    status: "draft",
    provider_mode: "image_provider",
    generation_stage: "discovery",
    quality_mode: "premium_editorial",
    brand_role: "brand_face",
    intended_usage: "social",
    candidate_count: 3,
    actual_cost: 0,
    generation_stage_history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as PersonaCreationProject;
}

describe("creation-workflow prepare confirmation gate", () => {
  let previousOpenAiKey: string | undefined;
  let previousSimulateProduction: string | undefined;

  beforeEach(() => {
    previousOpenAiKey = process.env.OPENAI_API_KEY;
    previousSimulateProduction = process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
    delete process.env.OPENAI_API_KEY;
    process.env.PERSONA_SIMULATE_PRODUCTION_ENV = "1";
  });

  afterEach(() => {
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
    if (previousSimulateProduction === undefined) {
      delete process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
    } else {
      process.env.PERSONA_SIMULATE_PRODUCTION_ENV = previousSimulateProduction;
    }
  });

  it("client UI: blocks without health safety when OPENAI_API_KEY is server-only", () => {
    const project = draftImageProviderProject();
    assert.equal(canPreparePaidConfirmation(project), false);
  });

  it("client UI: allows draft discovery image_provider when health reports provider ready", () => {
    const project = draftImageProviderProject();
    const safety = {
      openaiApiKeyConfigured: true,
      paidGenerationEnabled: true,
      fakeProviderActive: false,
      liveTestsEnabled: false,
    };
    assert.equal(canPreparePaidConfirmation(project, safety), true);

    const gate = evaluatePreparePaidConfirmationGate({
      project,
      projectLoaded: true,
      busy: false,
      paidGenerationSafety: safety,
    });
    assert.equal(gate.allowed, true);
    assert.deepEqual(gate.disabledReasons, []);
  });

  it("client UI: blocks until health is loaded", () => {
    const project = draftImageProviderProject();
    const gate = evaluatePreparePaidConfirmationGate({
      project,
      projectLoaded: true,
      busy: false,
      paidGenerationSafety: null,
    });
    assert.equal(gate.allowed, false);
    assert.ok(gate.disabledReasons.includes("health_not_loaded"));
    assert.equal(gate.reasons.healthLoaded, false);
  });
});
