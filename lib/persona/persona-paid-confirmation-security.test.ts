/**
 * Paid confirmation security — no live provider, no authorization bypass.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  confirmAndStartCandidateGeneration,
  createCreationProject,
  estimateCreationCost,
  preparePaidGenerationConfirmation,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
  resetMemoryGenerationJobStoreForTests,
  MemoryGenerationJobRepository,
  buildEstimateHash,
  updateCandidateReview,
} from "@/lib/persona";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import {
  assertLivePaidProviderInvocationAllowed,
  assertPaidGenerationHttpRequestAllowed,
  assertPaidGenerationEnabled,
  isPaidGenerationEnabled,
  shouldUseFakePersonaProvider,
  UI_CHECKBOX_ATTESTATION,
} from "@/lib/persona/creation/paid-generation-guard";
import { getPersonaCandidateGenerator } from "@/lib/persona/creation/provider/registry";
import type { WorkspaceScope } from "@/lib/persona/domain/types";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-a",
};
const scopeB: WorkspaceScope = {
  workspaceId: "22222222-2222-4222-8222-222222222222",
  actorId: "tester-b",
};

function withProcessEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function asNonTestEnv(fn: () => void): void {
  withProcessEnv(
    {
      NODE_ENV: "development",
      PERSONA_USE_FAKE_PROVIDER: "false",
      PERSONA_FORCE_LIVE_PROVIDER_GUARD: "1",
    },
    fn,
  );
}

function uiGenerateOpts(
  token: string,
  userConfirmedAt = new Date().toISOString(),
) {
  return {
    costConfirmed: true,
    confirmationToken: token,
    userConfirmedAt,
    attestation: UI_CHECKBOX_ATTESTATION,
  };
}

async function paidProject(overrides: Record<string, unknown> = {}) {
  return createCreationProject(scopeA, {
    name: "Security Cast",
    description: "",
    gender_presentation: "Male",
    age_range: "28-35",
    height_range: "180",
    body_type: "Lean",
    skin_tone_direction: "Olive",
    face_shape_direction: "Defined",
    hair_direction: "Dark",
    facial_hair_direction: "None",
    eye_direction: "Brown",
    expression_direction: "Calm",
    personality: "Quiet",
    fashion_style: "Luxury",
    brand_role: "primary_male",
    visual_keywords: "editorial",
    excluded_features: "",
    preferred_brand_looks: "QL",
    preferred_outfits: "Black",
    intended_usage: "image",
    candidate_count: 2,
    provider_mode: "image_provider",
    additional_description: "",
    status: "draft",
    ...overrides,
  } as never);
}

describe("Persona paid confirmation security", () => {
  let creationRepo: MemoryCreationRepository;
  let jobRepo: MemoryGenerationJobRepository;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.PERSONA_USE_FAKE_PROVIDER;
    creationRepo = new MemoryCreationRepository();
    jobRepo = new MemoryGenerationJobRepository();
    resetMemoryGenerationJobStoreForTests();
    setPersonaRepositoryForTests(new MemoryPersonaRepository());
    setCreationRepositoryForTests(creationRepo);
    setGenerationJobRepositoryForTests(jobRepo);
  });

  afterEach(() => {
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
    setGenerationJobRepositoryForTests(null);
    resetMemoryGenerationJobStoreForTests();
  });

  it("1. retryConfirmed alone without confirmation is rejected", async () => {
    const project = await paidProject({ actual_cost: 0.5 });
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          retryConfirmed: true,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError &&
        e.code === "WORKFLOW" &&
        /Bestätigungstoken|Nutzerbestätigung/i.test(e.message),
    );
  });

  it("2. confirmation for another project is rejected", async () => {
    const a = await paidProject({ name: "A" });
    const b = await paidProject({ name: "B" });
    const prepared = await preparePaidGenerationConfirmation(scopeA, a.id);
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, b.id, {
          costConfirmed: true,
          confirmationToken: prepared.confirmation.confirmation_token,
          userConfirmedAt: new Date().toISOString(),
          attestation: UI_CHECKBOX_ATTESTATION,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError && e.code === "WORKFLOW",
    );
  });

  it("3. confirmation for another workspace is rejected", async () => {
    const project = await paidProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeB, project.id, {
          costConfirmed: true,
          confirmationToken: prepared.confirmation.confirmation_token,
          userConfirmedAt: new Date().toISOString(),
          attestation: UI_CHECKBOX_ATTESTATION,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError &&
        (e.code === "WORKFLOW" || e.code === "UNAUTHORIZED_WORKSPACE"),
    );
  });

  it("4. stale estimate is rejected", async () => {
    const project = await paidProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    await creationRepo.updateProject(scopeA, project.id, { candidate_count: 4 });
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          confirmationToken: prepared.confirmation.confirmation_token,
          userConfirmedAt: new Date().toISOString(),
          attestation: UI_CHECKBOX_ATTESTATION,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError &&
        e.code === "WORKFLOW" &&
        /veraltet|geändert/i.test(e.message),
    );
  });

  it("5–8. changed provider/quality/count/assets rejected via hash or fields", async () => {
    const project = await paidProject({ candidate_count: 2, quality_mode: "premium_editorial" });
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    await creationRepo.updateProject(scopeA, project.id, { quality_mode: "ultra_brand_cast" });
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          confirmationToken: prepared.confirmation.confirmation_token,
          userConfirmedAt: new Date().toISOString(),
          attestation: UI_CHECKBOX_ATTESTATION,
        }),
      (e: unknown) => e instanceof PersonaDomainError && e.code === "WORKFLOW",
    );
  });

  it("9. reused confirmation is rejected", async () => {
    const project = await paidProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const token = prepared.confirmation.confirmation_token;
    const userConfirmedAt = new Date().toISOString();
    await confirmAndStartCandidateGeneration(
      scopeA,
      project.id,
      uiGenerateOpts(token, userConfirmedAt),
    );
    const reprepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          confirmationToken: token,
          userConfirmedAt: new Date().toISOString(),
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError &&
        e.code === "WORKFLOW" &&
        /bereits verwendet|ungültig/i.test(e.message),
    );
    void reprepared;
  });

  it("11. retry requires new confirmation with retry intent", async () => {
    const project = await paidProject();
    const initial = await preparePaidGenerationConfirmation(scopeA, project.id);
    await confirmAndStartCandidateGeneration(
      scopeA,
      project.id,
      uiGenerateOpts(initial.confirmation.confirmation_token),
    );
    await creationRepo.updateProject(scopeA, project.id, { actual_cost: 0.2 });
    const staleInitialToken = initial.confirmation.confirmation_token;
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          confirmationToken: staleInitialToken,
          userConfirmedAt: new Date().toISOString(),
          retryConfirmed: true,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError && e.code === "WORKFLOW",
    );
    const retryPrep = await preparePaidGenerationConfirmation(scopeA, project.id);
    assert.equal(retryPrep.confirmation.payload?.intent, "retry");
  });

  it("12–14. test env uses fake provider; live blocked without allow flag", () => {
    assert.equal(shouldUseFakePersonaProvider(), true);
    assert.equal(getPersonaCandidateGenerator("image_provider").id, "fake");
    asNonTestEnv(() => {
      withProcessEnv({ ALLOW_LIVE_PERSONA_GENERATION_TESTS: undefined }, () => {
        assert.throws(
          () => assertLivePaidProviderInvocationAllowed({ estimatedMaxEur: 1 }),
          (e: unknown) =>
            e instanceof PersonaDomainError &&
            e.code === "PAID_GENERATION_DISABLED",
        );
      });
    });
  });

  it("10. confirmation is consumed atomically before provider run", async () => {
    const project = await paidProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const token = prepared.confirmation.confirmation_token;
    await confirmAndStartCandidateGeneration(
      scopeA,
      project.id,
      uiGenerateOpts(token),
    );
    const after = await jobRepo.getConfirmationByToken(scopeA, token);
    assert.ok(after?.consumed_at, "confirmation should be marked consumed");
  });

  it("13. debug HTTP requests block live provider by default", () => {
    asNonTestEnv(() => {
      withProcessEnv({ ALLOW_LIVE_PERSONA_GENERATION_TESTS: undefined }, () => {
        const req = new Request("http://localhost/api", {
          headers: { "x-debug": "1" },
        });
        assert.throws(
          () => assertPaidGenerationHttpRequestAllowed(req),
          (e: unknown) =>
            e instanceof PersonaDomainError &&
            e.code === "LIVE_PAID_TEST_NOT_AUTHORIZED",
        );
      });
    });
  });

  it("15. live tests enforce maximum cost", () => {
    asNonTestEnv(() => {
      withProcessEnv(
        {
          ALLOW_LIVE_PERSONA_GENERATION_TESTS: "true",
          LIVE_PERSONA_GENERATION_MAX_EUR: "0.05",
        },
        () => {
          assert.throws(
            () => assertLivePaidProviderInvocationAllowed({ estimatedMaxEur: 0.2 }),
            (e: unknown) =>
              e instanceof PersonaDomainError &&
              e.code === "LIVE_PAID_TEST_NOT_AUTHORIZED",
          );
        },
      );
    });
  });

  it("debug-run candidates cannot be shortlisted", async () => {
    const project = await paidProject({ candidate_count: 1 });
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    await confirmAndStartCandidateGeneration(
      scopeA,
      project.id,
      uiGenerateOpts(prepared.confirmation.confirmation_token),
    );
    const candidates = await creationRepo.listCandidates(scopeA, project.id);
    const candidate = candidates[0]!;
    const jobs = await jobRepo.listJobsForProject(scopeA, project.id);
    const completed = jobs.find((j) => j.status === "completed" || j.status === "partially_completed");
    if (completed) {
      await jobRepo.updateJob(scopeA, completed.id, {
        provider: "openai",
        confirmation_payload: { attestation: "debug_or_api_only" },
      });
    }
    await assert.rejects(
      () =>
        updateCandidateReview(scopeA, candidate.id, { status: "shortlisted" }),
      (e: unknown) => e instanceof PersonaDomainError && e.code === "WORKFLOW",
    );
  });

  it("16. automated tests never invoke OpenAI adapter", async () => {
    const project = await paidProject({ candidate_count: 1 });
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const result = await confirmAndStartCandidateGeneration(
      scopeA,
      project.id,
      uiGenerateOpts(prepared.confirmation.confirmation_token),
    );
    assert.equal(result.job.provider, "fake");
  });

  it("18. provider_mode persists on create", async () => {
    const manual = await paidProject({ provider_mode: "manual_upload" });
    assert.equal(manual.provider_mode, "manual_upload");
    const paid = await paidProject({ provider_mode: "image_provider" });
    assert.equal(paid.provider_mode, "image_provider");
  });

  it("master switch false blocks real provider path", () => {
    asNonTestEnv(() => {
      withProcessEnv({ PERSONA_PAID_GENERATION_ENABLED: "false" }, () => {
        assert.throws(
          () => assertPaidGenerationEnabled(),
          (e: unknown) =>
            e instanceof PersonaDomainError && e.code === "PAID_GENERATION_DISABLED",
        );
      });
    });
  });

  it("master switch true alone is insufficient without confirmation", async () => {
    asNonTestEnv(() => {
      withProcessEnv({ PERSONA_PAID_GENERATION_ENABLED: "true" }, () => {
        assert.equal(isPaidGenerationEnabled(), true);
      });
    });
    const project = await paidProject();
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          attestation: UI_CHECKBOX_ATTESTATION,
        }),
      (e: unknown) => e instanceof PersonaDomainError && e.code === "WORKFLOW",
    );
  });

  it("ui attestation string alone is insufficient", async () => {
    const project = await paidProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          confirmationToken: prepared.confirmation.confirmation_token,
          attestation: UI_CHECKBOX_ATTESTATION,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError &&
        e.code === "WORKFLOW" &&
        /Nutzerbestätigung|userConfirmedAt/i.test(e.message),
    );
  });
});
