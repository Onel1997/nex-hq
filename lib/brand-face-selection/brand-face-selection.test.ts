/**
 * Phase 1.8 — Official Brand Face Selection Workflow.
 * Never invokes OpenAI, Image Studio, or Video Studio.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  MILAENE_BRAND_ARCHETYPES,
  loadBrandArchetypeCatalog,
} from "@/lib/brand-archetypes";
import {
  A1_DISCOVERY_CANDIDATE_COUNT,
  A2_MAX_SHORTLIST,
  OFFICIAL_MILAENE_ARCHETYPE_COUNT,
  BrandFaceSelectionError,
  assertA1CompleteLeavesA2Idle,
  assertA1DoesNotAutoStartA2,
  assertCandidateMayExpandInA2,
  assertFreshA2Confirmation,
  assertNoFakeVisualScore,
  assertNoImageStudioCall,
  assertNoVideoStudioCall,
  assertOnlyOneActivePerArchetype,
  assertOpenAiSamePersonExpansionBlocked,
  attachDraftPersona,
  approveAllRequiredReferenceSlots,
  approveOfficialBrandFace,
  beginA2Validation,
  beginDiscoveryGenerating,
  beginIdentityReview,
  buildA1DiscoveryPlan,
  buildA2ValidationPlan,
  buildDiscoveryBrief,
  completeA1Discovery,
  completeA2Validation,
  createBrandFaceSelectionProject,
  creationProjectInputForArchetypeId,
  emptyIdentityChecklist,
  getBrandFaceProductionPackage,
  getOfficialBrandFace,
  getOfficialBrandFaceMilestone,
  listOfficialBrandFaces,
  listRetiredBrandFaces,
  lockBrandFaceIdentity,
  passAllIdentityChecks,
  parseArchetypeIdFromProjectDescription,
  prepareDiscoveryReady,
  prepareValidationReady,
  rateDiscoveryCandidate,
  recommendOfficialBrandFaceForCampaign,
  recommendOfficialBrandFaceForVideo,
  registerOfficialBrandFace,
  rejectDiscoveryCandidate,
  resetBrandFaceSelectionStoreForTests,
  saveSelectionProject,
  selectFinalCandidate,
  shortlistDiscoveryCandidate,
  ARCHETYPE_PROJECT_MARKER,
  BRAND_FACE_IDENTITY_CHECK_KEYS,
  assertCastingCardHasNoContinueSession,
  buildArchetypeCastingCardModel,
  DiscoveryStartLock,
  resolveDiscoverySessionProjectId,
  resolveOfficialArchetypeStatus,
  resolveStartDiscoveryDisabledReason,
  summarizeArchetypeCreationRuns,
} from "./index";

const WS = "ws-milaene";

const ARCH = {
  mediterranean: "arch-mediterranean-premium-hero",
  urban: "arch-urban-community-hero",
  female: "arch-female-lifestyle-hero",
} as const;

function candidateIds(n = 4): string[] {
  return Array.from({ length: n }, (_, i) => `cand-${i + 1}`);
}

function runToDiscoveryReview(
  archetypeId: string = ARCH.mediterranean,
  projectId?: string,
) {
  let project = createBrandFaceSelectionProject({
    workspaceId: WS,
    archetypeId,
    id: projectId ?? `bfs-test-${archetypeId}-${crypto.randomUUID().slice(0, 8)}`,
  });
  project = prepareDiscoveryReady(project);
  project = beginDiscoveryGenerating(project, "confirm-a1-token-hash");
  project = completeA1Discovery(project, candidateIds());
  assertA1CompleteLeavesA2Idle(project);
  return project;
}

function runToAfterA2(archetypeId: string = ARCH.mediterranean, projectId?: string) {
  let project = runToDiscoveryReview(archetypeId, projectId);
  project = shortlistDiscoveryCandidate(project, "cand-1");
  project = shortlistDiscoveryCandidate(project, "cand-2");
  project = rejectDiscoveryCandidate(project, "cand-3", "not a fit");
  project = prepareValidationReady(project);
  project = beginA2Validation(project, "confirm-a2-token-hash");
  project = completeA2Validation(project);
  return project;
}

function runToApproved(archetypeId: string, personaSuffix: string) {
  let project = runToAfterA2(
    archetypeId,
    `bfs-${personaSuffix}-${crypto.randomUUID().slice(0, 8)}`,
  );
  project = selectFinalCandidate(project, "cand-1");
  project = attachDraftPersona(project, `persona-${personaSuffix}`);
  project = approveAllRequiredReferenceSlots(project);
  project = beginIdentityReview(project);
  project = passAllIdentityChecks(project);
  project = lockBrandFaceIdentity(project);
  project = approveOfficialBrandFace(project, {
    rightsConfirmed: true,
    imageUseApproved: true,
    videoReady: false,
  });
  const face = registerOfficialBrandFace(project);
  saveSelectionProject(project);
  return { project, face };
}

describe("Official Brand Face Selection (Phase 1.8)", () => {
  beforeEach(() => {
    resetBrandFaceSelectionStoreForTests();
  });

  afterEach(() => {
    resetBrandFaceSelectionStoreForTests();
  });

  it("1. selection project is tied to one archetype", () => {
    const project = createBrandFaceSelectionProject({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
    });
    assert.equal(project.archetypeId, ARCH.mediterranean);
    assert.equal(project.targetRole, "mediterranean_premium_hero");
    assert.ok(project.identityDnaFingerprint.length > 8);
    assert.equal(project.status, "draft");
    assert.equal(project.discoveryCandidateCount, A1_DISCOVERY_CANDIDATE_COUNT);
    assert.equal(project.selectedCandidateId, null);
    assert.deepEqual(project.shortlistCandidateIds, []);

    const catalog = loadBrandArchetypeCatalog(WS);
    const arch = catalog.archetypes.find((a) => a.id === ARCH.mediterranean)!;
    assert.equal(project.archetypeVersion, arch.version);
  });

  it("2. A1 generates one portrait per candidate", () => {
    const project = createBrandFaceSelectionProject({
      workspaceId: WS,
      archetypeId: ARCH.urban,
    });
    const plan = buildA1DiscoveryPlan(project);
    assert.equal(plan.candidateCount, 4);
    assert.equal(plan.portraitsPerCandidate, 1);
    assert.equal(plan.totalImages, 4);
    assert.deepEqual(plan.assetTypes, ["portrait_front"]);

    const brief = buildDiscoveryBrief(project, { min: 1.2, max: 2.4 });
    assert.equal(brief.archetypeName, "Urban Community Hero");
    assert.equal(brief.candidateCount, 4);
    assert.equal(brief.portraitsPerCandidate, 1);
    assert.ok(brief.productAffinities.length >= 1);
    assert.ok(brief.bestPlatforms.length >= 1);
    assert.ok(brief.identityDnaSummary.fingerprint);
    assert.deepEqual(brief.expectedCostEur, { min: 1.2, max: 2.4 });
    assert.equal(brief.requiresPaidConfirmation, true);
  });

  it("3. A1 does not auto-start A2", () => {
    const project = runToDiscoveryReview();
    const plan = buildA1DiscoveryPlan(project);
    assertA1DoesNotAutoStartA2(plan);
    assert.equal(plan.autoStartA2, false);
    assert.equal(plan.autoShortlist, false);
    assert.equal(plan.autoSelect, false);
    assert.equal(project.status, "discovery_review");
    assert.equal(project.a2CompletedAt, null);
    assertA1CompleteLeavesA2Idle(project);
  });

  it("4. max 2 shortlist candidates", () => {
    let project = runToDiscoveryReview();
    project = shortlistDiscoveryCandidate(project, "cand-1");
    project = shortlistDiscoveryCandidate(project, "cand-2");
    assert.equal(project.shortlistCandidateIds.length, A2_MAX_SHORTLIST);
    assert.throws(
      () => shortlistDiscoveryCandidate(project, "cand-3"),
      (err: unknown) =>
        err instanceof BrandFaceSelectionError && /Maximum 2/i.test(err.message),
    );
  });

  it("5. A2 requires fresh confirmation", () => {
    let project = runToDiscoveryReview();
    project = shortlistDiscoveryCandidate(project, "cand-1");
    project = prepareValidationReady(project);

    assert.throws(
      () => beginA2Validation(project, "confirm-a1-token-hash"),
      (err: unknown) =>
        err instanceof BrandFaceSelectionError &&
        err.code === "CONFIRMATION" &&
        /new confirmation|cannot be reused/i.test(err.message),
    );

    assert.throws(
      () => assertFreshA2Confirmation(project, ""),
      (err: unknown) =>
        err instanceof BrandFaceSelectionError && err.code === "CONFIRMATION",
    );

    project = beginA2Validation(project, "confirm-a2-fresh-token");
    assert.equal(project.status, "validation_generating");
    assert.equal(project.lastConfirmationFingerprint, "confirm-a2-fresh-token");
  });

  it("6. only shortlisted candidates can expand", () => {
    let project = runToDiscoveryReview();
    project = shortlistDiscoveryCandidate(project, "cand-1");
    project = prepareValidationReady(project);

    assert.throws(
      () => assertCandidateMayExpandInA2(project, "cand-4"),
      (err: unknown) =>
        err instanceof BrandFaceSelectionError && /shortlisted/i.test(err.message),
    );

    const plan = buildA2ValidationPlan(project);
    assert.deepEqual(plan.candidateIds, ["cand-1"]);
    assert.equal(plan.requiresFreshConfirmation, true);
    assert.equal(plan.autoContinue, false);
  });

  it("7. exactly one final candidate per archetype", () => {
    let project = runToAfterA2();
    project = selectFinalCandidate(project, "cand-1");
    assert.equal(project.selectedCandidateId, "cand-1");

    assert.throws(
      () => selectFinalCandidate(project, "cand-2"),
      (err: unknown) =>
        err instanceof BrandFaceSelectionError &&
        /Exactly one final candidate/i.test(err.message),
    );

    // Rejected candidates preserved
    assert.ok(project.rejectedCandidateIds.includes("cand-3"));
  });

  it("8. conversion creates Draft Persona attachment", () => {
    let project = runToAfterA2();
    project = selectFinalCandidate(project, "cand-1");
    project = attachDraftPersona(project, "persona-draft-1");
    assert.equal(project.draftPersonaId, "persona-draft-1");
    assert.equal(project.brandFaceApprovalStatus, "not_started");
    assert.equal(project.imageUseApproved, false);
  });

  it("9. reference review required", () => {
    let project = runToAfterA2();
    project = selectFinalCandidate(project, "cand-1");
    project = attachDraftPersona(project, "persona-ref-1");
    assertOpenAiSamePersonExpansionBlocked(project);

    assert.throws(
      () => beginIdentityReview(project),
      (err: unknown) =>
        err instanceof BrandFaceSelectionError &&
        /Reference package must be complete/i.test(err.message),
    );

    project = approveAllRequiredReferenceSlots(project);
    assert.equal(project.referencePackageStatus, "complete");
    project = beginIdentityReview(project);
    assert.equal(project.status, "identity_review");
  });

  it("10. identity lock required", () => {
    let project = runToAfterA2();
    project = selectFinalCandidate(project, "cand-1");
    project = attachDraftPersona(project, "persona-lock-1");
    project = approveAllRequiredReferenceSlots(project);
    project = beginIdentityReview(project);

    assert.throws(
      () => lockBrandFaceIdentity(project),
      (err: unknown) =>
        err instanceof BrandFaceSelectionError &&
        /Identity review must pass/i.test(err.message),
    );

    project = passAllIdentityChecks(project);
    project = lockBrandFaceIdentity(project);
    assert.equal(project.status, "identity_locked");
    assert.equal(project.identityLockStatus, "locked");
    assert.equal(project.identityLock?.imageUseEnabledByLock, false);
    assert.equal(project.identityLock?.videoUseEnabledByLock, false);
    assert.equal(project.imageUseApproved, false);
  });

  it("11. approval requires image readiness", () => {
    let project = runToAfterA2();
    project = selectFinalCandidate(project, "cand-1");
    project = attachDraftPersona(project, "persona-approve-1");
    project = approveAllRequiredReferenceSlots(project);
    project = beginIdentityReview(project);
    project = passAllIdentityChecks(project);
    project = lockBrandFaceIdentity(project);

    assert.throws(
      () =>
        approveOfficialBrandFace(project, {
          rightsConfirmed: true,
          imageUseApproved: false,
        }),
      (err: unknown) =>
        err instanceof BrandFaceSelectionError &&
        /image_use_approved must be true/i.test(err.message),
    );

    project = approveOfficialBrandFace(project, {
      rightsConfirmed: true,
      imageUseApproved: true,
    });
    assert.equal(project.status, "approved");
    assert.equal(project.brandFaceApprovalStatus, "approved");
    assert.equal(project.imageUseApproved, true);
    assert.equal(project.videoReady, false);
  });

  it("12. only one active Brand Face per archetype", () => {
    const first = runToApproved(ARCH.mediterranean, "v1");
    assertOnlyOneActivePerArchetype(WS, ARCH.mediterranean);
    assert.equal(getOfficialBrandFace(ARCH.mediterranean, WS)?.id, first.face.id);

    const second = runToApproved(ARCH.mediterranean, "v2");
    assertOnlyOneActivePerArchetype(WS, ARCH.mediterranean);
    const active = getOfficialBrandFace(ARCH.mediterranean, WS);
    assert.ok(active);
    assert.equal(active!.personaId, "persona-v2");
    assert.equal(active!.id, second.face.id);
    assert.notEqual(active!.id, first.face.id);
  });

  it("13. registry preserves retired faces", () => {
    const first = runToApproved(ARCH.urban, "urban-1");
    const second = runToApproved(ARCH.urban, "urban-2");
    void second;
    const retired = listRetiredBrandFaces(WS, ARCH.urban);
    assert.ok(retired.some((f) => f.id === first.face.id));
    const all = listOfficialBrandFaces(WS);
    assert.ok(all.some((f) => f.status === "retired"));
    assert.ok(all.some((f) => f.status === "active" && f.personaId === "persona-urban-2"));
  });

  it("14. milestone counts exactly three archetypes", () => {
    assert.equal(MILAENE_BRAND_ARCHETYPES.length, OFFICIAL_MILAENE_ARCHETYPE_COUNT);
    let milestone = getOfficialBrandFaceMilestone(WS);
    assert.equal(milestone.requiredCount, 3);
    assert.equal(milestone.approvedCount, 0);
    assert.equal(milestone.archetypes.length, 3);
    assert.equal(milestone.complete, false);
    for (const row of milestone.archetypes) {
      assert.equal(row.approvedCount, 0);
      assert.equal(row.requiredCount, 1);
    }

    runToApproved(ARCH.mediterranean, "m1");
    runToApproved(ARCH.urban, "u1");
    runToApproved(ARCH.female, "f1");

    milestone = getOfficialBrandFaceMilestone(WS);
    assert.equal(milestone.approvedCount, 3);
    assert.equal(milestone.requiredCount, 3);
    assert.equal(milestone.complete, true);
    assert.match(milestone.label, /3\/3 Official Milaene Brand Faces/);
  });

  it("15. no Image Studio call", () => {
    assertNoImageStudioCall();
    const pkg = getBrandFaceProductionPackage("missing", WS);
    assert.equal(pkg, null);
  });

  it("16. no Video Studio call", () => {
    assertNoVideoStudioCall();
    const recs = recommendOfficialBrandFaceForVideo(
      { platform: "instagram" },
      WS,
    );
    assert.ok(Array.isArray(recs));
  });

  it("17. no OpenAI calls during tests (expansion blocked)", () => {
    const project = runToDiscoveryReview();
    assertOpenAiSamePersonExpansionBlocked(project);
    assert.equal(
      project.referencePackage.openaiSamePersonExpansionBlocked,
      true,
    );
    // Fake visual score never invented
    const review = project.candidateReviews["cand-1"]!;
    assert.equal(review.visualEvaluation, "not_performed");
    assertNoFakeVisualScore(review);
    const rated = rateDiscoveryCandidate(project, "cand-1", 4);
    assert.equal(rated.candidateReviews["cand-1"]!.manualRating, 4);
    assert.equal(
      rated.candidateReviews["cand-1"]!.visualEvaluation,
      "not_performed",
    );
  });

  it("18. handoffs remain read-only and checklist keys are complete", () => {
    runToApproved(ARCH.mediterranean, "hand-1");
    const face = getOfficialBrandFace(ARCH.mediterranean, WS);
    assert.ok(face);
    const pkg = getBrandFaceProductionPackage(face!.personaId, WS);
    assert.ok(pkg);
    assert.equal(pkg!.imageReady, true);
    assert.equal(pkg!.videoReady, false);
    assert.ok(pkg!.immutableFeatures.includes("facial identity"));
    assert.ok(pkg!.flexibleFeatures.includes("clothing"));

    const campaignRecs = recommendOfficialBrandFaceForCampaign(
      { platform: "homepage" },
      WS,
    );
    assert.ok(campaignRecs.length >= 1);

    assert.equal(BRAND_FACE_IDENTITY_CHECK_KEYS.length, 11);
    const empty = emptyIdentityChecklist();
    for (const key of BRAND_FACE_IDENTITY_CHECK_KEYS) {
      assert.equal(empty[key].passed, false);
    }
  });

  it("19. archetype maps to creation project without user-edited traits", () => {
    const input = creationProjectInputForArchetypeId(ARCH.mediterranean, WS);
    assert.equal(input.candidate_count, 4);
    assert.equal(input.provider_mode, "image_provider");
    assert.equal(input.brand_role, "primary_male");
    assert.match(input.name, /Mediterranean Premium Hero/);
    assert.ok(input.face_shape_direction.length > 10);
    assert.ok(input.body_type.length > 5);
    assert.ok(input.hair_direction.length > 5);
    assert.ok(input.fashion_style.length > 5);
    assert.ok(
      input.description.includes(`${ARCHETYPE_PROJECT_MARKER}${ARCH.mediterranean}`),
    );
    assert.equal(
      parseArchetypeIdFromProjectDescription(input.description),
      ARCH.mediterranean,
    );

    const female = creationProjectInputForArchetypeId(ARCH.female, WS);
    assert.equal(female.brand_role, "primary_female");
    assert.match(female.gender_presentation, /Female/i);

    const urban = creationProjectInputForArchetypeId(ARCH.urban, WS);
    assert.equal(urban.brand_role, "secondary_male");
  });
});

describe("Phase 1.8B Brand Face Casting Start UX", () => {
  beforeEach(() => resetBrandFaceSelectionStoreForTests());
  afterEach(() => resetBrandFaceSelectionStoreForTests());

  const oldCreationRuns = [
    {
      id: "proj-old-1",
      description: `Official Milaene Brand Face Selection. ${ARCHETYPE_PROJECT_MARKER}${ARCH.mediterranean}`,
      status: "review" as const,
    },
    {
      id: "proj-old-2",
      description: `Official Milaene Brand Face Selection. ${ARCHETYPE_PROJECT_MARKER}${ARCH.mediterranean}`,
      status: "generating" as const,
    },
  ];

  it("1. casting card never exposes Continue session", () => {
    const model = buildArchetypeCastingCardModel({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
      archetypeActive: true,
      creationProjects: oldCreationRuns,
    });
    assertCastingCardHasNoContinueSession(model);
    assert.equal(model.primaryAction, "start_new_discovery");
    assert.notEqual(model.primaryAction, "continue_session" as never);
  });

  it("2. previous projects do not replace primary action", () => {
    const model = buildArchetypeCastingCardModel({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
      archetypeActive: true,
      creationProjects: oldCreationRuns,
    });
    assert.equal(model.primaryAction, "start_new_discovery");
    assert.equal(model.startDiscoveryDisabledReason, null);
  });

  it("3. Start New Discovery creates a new selection project every time", () => {
    const first = createBrandFaceSelectionProject({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
      id: "bfs-first",
    });
    const second = createBrandFaceSelectionProject({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
      id: "bfs-second",
    });
    assert.notEqual(first.id, second.id);
    assert.equal(first.archetypeId, ARCH.mediterranean);
    assert.equal(second.archetypeId, ARCH.mediterranean);
  });

  it("4. old creation projects remain unchanged when summarizing runs", () => {
    const summary = summarizeArchetypeCreationRuns(oldCreationRuns, ARCH.mediterranean);
    assert.equal(summary.previousRunCount, 2);
    assert.deepEqual(oldCreationRuns.map((p) => p.status), ["review", "generating"]);
  });

  it("5. new creation project input links to selected archetype", () => {
    const input = creationProjectInputForArchetypeId(ARCH.mediterranean, WS);
    assert.equal(
      parseArchetypeIdFromProjectDescription(input.description),
      ARCH.mediterranean,
    );
    assert.match(input.description, /identity_dna:/);
  });

  it("6. navigation uses newly returned project id", () => {
    assert.equal(resolveDiscoverySessionProjectId("proj-new-abc"), "proj-new-abc");
    assert.throws(() => resolveDiscoverySessionProjectId(null));
    assert.throws(() => resolveDiscoverySessionProjectId(""));
  });

  it("7. official status ignores latest old creation project state", () => {
    const status = resolveOfficialArchetypeStatus({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
      selectionProjects: [],
    });
    assert.equal(status.label, "0/1 freigegeben — bereit für die Entdeckung");
    assert.ok(!/discovery review/i.test(status.label));
    assert.ok(!/session/i.test(status.label));
  });

  it("8. duplicate click creates only one in-flight discovery start", () => {
    const lock = new DiscoveryStartLock();
    assert.equal(lock.tryAcquire(ARCH.mediterranean), true);
    assert.equal(lock.tryAcquire(ARCH.mediterranean), false);
    lock.release();
    assert.equal(lock.tryAcquire(ARCH.urban), true);
  });

  it("9. discovery generating starts only after explicit confirmation token", () => {
    let project = createBrandFaceSelectionProject({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
    });
    project = prepareDiscoveryReady(project);
    assert.equal(project.status, "discovery_ready");
    project = beginDiscoveryGenerating(project, "paid-confirm-token");
    assert.equal(project.status, "discovery_generating");
    assert.equal(project.lastConfirmationFingerprint, "paid-confirm-token");
  });

  it("10. start button disabled only during creation or failed gate", () => {
    assert.equal(
      resolveStartDiscoveryDisabledReason({
        archetypeActive: true,
        isCreating: false,
        providerGateFailed: false,
      }),
      null,
    );
    assert.match(
      resolveStartDiscoveryDisabledReason({
        archetypeActive: true,
        isCreating: true,
        providerGateFailed: false,
      }) ?? "",
      /angelegt|Entdeckungsprojekt/i,
    );
    assert.match(
      resolveStartDiscoveryDisabledReason({
        archetypeActive: true,
        isCreating: false,
        providerGateFailed: true,
      }) ?? "",
      /bezahlt|Anbieter|konfiguriert/i,
    );
    assert.equal(
      resolveStartDiscoveryDisabledReason({
        archetypeActive: true,
        isCreating: false,
        providerGateFailed: false,
      }),
      null,
      "Previous runs must not disable start",
    );
  });

  it("11. previous run count is displayed separately from official status", () => {
    const model = buildArchetypeCastingCardModel({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
      archetypeActive: true,
      creationProjects: oldCreationRuns,
    });
    assert.equal(model.previousRunCount, 2);
    assert.equal(model.officialStatus.label, "0/1 freigegeben — bereit für die Entdeckung");
  });

  it("12. unfinished run count points users to Creation Projects browsing", () => {
    const model = buildArchetypeCastingCardModel({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
      archetypeActive: true,
      creationProjects: oldCreationRuns,
    });
    assert.equal(model.unfinishedRunCount, 2);
  });

  it("13. official archetype status follows selection workflow not creation projects", () => {
    const selection = runToDiscoveryReview(ARCH.mediterranean, "bfs-status-test");
    const status = resolveOfficialArchetypeStatus({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
      selectionProjects: [selection],
    });
    assert.match(status.label, /Casting läuft/i);
    assert.ok(!/discovery review/i.test(status.label));
  });

  it("14. official status requires an explicitly supplied authority projection", () => {
    const { face } = runToApproved(ARCH.mediterranean, "ux-approved");
    const model = buildArchetypeCastingCardModel({
      workspaceId: WS,
      archetypeId: ARCH.mediterranean,
      archetypeActive: true,
      creationProjects: oldCreationRuns,
      activeFace: face,
    });
    assert.equal(model.primaryAction, "view_brand_cast");
    assert.match(model.officialStatus.label, /offizielles Markenmodel/i);
  });
});
