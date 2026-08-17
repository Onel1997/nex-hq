import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { PersonaReferenceAsset, WorkspaceScope } from "@/lib/persona/domain/types";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import { resolveLockedBrandIdentity } from "../identity-lock";
import { evaluateBrandModelEligibility } from "../use-approvals/eligibility";
import { getReferenceRightsEvidenceRepository } from "./repository";
import {
  REFERENCE_RIGHTS_CONFIRMATION_SCOPE,
  REFERENCE_RIGHTS_EVIDENCE_VERSION,
  referenceRightsEvidencePayloadSchema,
  type ReferenceRightsConfirmations,
  type ReferenceRightsEvidence,
  type ReferenceRightsView,
  type SubmitReferenceRightsDecisionInput,
} from "./types";

const RIGHTS_CONFIRMATION_KEYS: Array<keyof ReferenceRightsConfirmations> = [
  "hasNecessaryRightsOrAuthorization",
  "masterIdentityReferenceAuthorized",
  "canonicalReferencesAuthorized",
  "aiAssistedImageProductionAuthorized",
  "workspaceBrandUseAuthorized",
];

async function loadCurrentRightsContext(scope: WorkspaceScope, personaId: string) {
  const persona = await getPersonaRepository().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", {
      personaId,
      workspaceId: scope.workspaceId,
    });
  }
  const lockedIdentity = await resolveLockedBrandIdentity(scope, personaId);
  if (!lockedIdentity) {
    throw new PersonaDomainError(
      "A valid current Identity Lock is required before reference rights can be confirmed.",
      "WORKFLOW",
      { personaId },
    );
  }
  const assets: Array<{
    role: ReferenceRightsView["assetRights"][number]["role"];
    asset: PersonaReferenceAsset;
  }> = [
    { role: "master", asset: lockedIdentity.masterReference },
    ...lockedIdentity.canonicalReferences.map((entry) => ({
      role: entry.slot,
      asset: entry.reference,
    })),
  ];
  const uniqueIds = new Set(assets.map((entry) => entry.asset.id));
  if (assets.length !== 6 || uniqueIds.size !== 6) {
    throw new PersonaDomainError(
      "The current Identity Lock does not contain one Master plus five distinct canonical references.",
      "WORKFLOW",
      { personaId, assetCount: assets.length, uniqueAssetCount: uniqueIds.size },
    );
  }
  return { persona, lockedIdentity, assets };
}

function exactEvidenceForCurrentLock(
  evidence: readonly ReferenceRightsEvidence[],
  context: Awaited<ReturnType<typeof loadCurrentRightsContext>>,
) {
  const canonicalIds = context.lockedIdentity.canonicalReferences.map(
    (entry) => entry.reference.id,
  );
  return (
    evidence.find(
      (row) =>
        row.decision === "confirmed" &&
        row.identityLockSnapshotId ===
          context.lockedIdentity.identityLockSnapshotId &&
        row.identityLockVersion === context.lockedIdentity.lockVersion &&
        row.identityFingerprint === context.lockedIdentity.identityFingerprint &&
        row.masterReferenceAssetId === context.lockedIdentity.masterReference.id &&
        row.canonicalReferenceAssetIds.length === canonicalIds.length &&
        row.canonicalReferenceAssetIds.every(
          (assetId, index) => assetId === canonicalIds[index],
        ),
    ) ?? null
  );
}

export async function getReferenceRightsView(
  scope: WorkspaceScope,
  personaId: string,
): Promise<ReferenceRightsView> {
  const context = await loadCurrentRightsContext(scope, personaId);
  const evidence = await getReferenceRightsEvidenceRepository().listForPersona(
    scope,
    personaId,
  );
  const missingRightsAssetIds = context.assets
    .filter((entry) => !entry.asset.rights_confirmed)
    .map((entry) => entry.asset.id);
  const rightsConfirmed = missingRightsAssetIds.length === 0;
  const exactAuditedConfirmation = exactEvidenceForCurrentLock(evidence, context);
  return {
    personaId,
    personaName: context.persona.name,
    identityLockSnapshotId: context.lockedIdentity.identityLockSnapshotId,
    identityLockVersion: context.lockedIdentity.lockVersion,
    identityFingerprint: context.lockedIdentity.identityFingerprint,
    masterReferenceAssetId: context.lockedIdentity.masterReference.id,
    canonicalReferenceAssetIds:
      context.lockedIdentity.canonicalReferences.map(
        (entry) => entry.reference.id,
      ),
    assetRights: context.assets.map((entry) => ({
      assetId: entry.asset.id,
      role: entry.role,
      rightsConfirmed: entry.asset.rights_confirmed,
    })),
    rightsConfirmed,
    missingRightsAssetIds,
    exactAuditedConfirmation,
    canConfirm: !rightsConfirmed,
    blockingReasons: rightsConfirmed
      ? []
      : ["Locked Brand Model reference rights are not confirmed."],
    providerCalled: false,
  };
}

function assertExpectedIdentity(
  context: Awaited<ReturnType<typeof loadCurrentRightsContext>>,
  input: SubmitReferenceRightsDecisionInput,
) {
  const locked = context.lockedIdentity;
  if (
    locked.identityLockSnapshotId !== input.expectedIdentityLockSnapshotId ||
    locked.lockVersion !== input.expectedIdentityLockVersion ||
    locked.identityFingerprint !== input.expectedIdentityFingerprint
  ) {
    throw new PersonaDomainError(
      "The Identity Lock changed after the rights review was opened. Review the current locked package again.",
      "BRAND_MODEL_VERSION_MISMATCH",
      {
        expected: {
          identityLockSnapshotId: input.expectedIdentityLockSnapshotId,
          identityLockVersion: input.expectedIdentityLockVersion,
          identityFingerprint: input.expectedIdentityFingerprint,
        },
        actual: {
          identityLockSnapshotId: locked.identityLockSnapshotId,
          identityLockVersion: locked.lockVersion,
          identityFingerprint: locked.identityFingerprint,
        },
      },
    );
  }
}

function validateExistingEvidence(
  evidence: ReferenceRightsEvidence,
  expected: ReturnType<typeof referenceRightsEvidencePayloadSchema.parse>,
) {
  const comparable = {
    ...evidence,
    id: undefined,
    createdAt: undefined,
    decidedAt: undefined,
  };
  const expectedComparable = {
    ...expected,
    id: undefined,
    createdAt: undefined,
    decidedAt: undefined,
  };
  if (JSON.stringify(comparable) !== JSON.stringify(expectedComparable)) {
    throw new PersonaDomainError(
      "This reference-rights operation ID already belongs to another decision, actor, or Identity Lock.",
      "WORKFLOW",
      { operationId: expected.operationId },
    );
  }
}

export async function submitReferenceRightsDecision(
  scope: WorkspaceScope,
  personaId: string,
  input: SubmitReferenceRightsDecisionInput,
): Promise<{
  decision: "confirmed" | "rejected";
  evidence: ReferenceRightsEvidence;
  rights: ReferenceRightsView;
  imageEligible: boolean;
  videoEligible: boolean;
  providerCalled: false;
}> {
  if (!scope.actorId) {
    throw new PersonaDomainError(
      "Authenticated owner actor is required for reference-rights review.",
      "AUTHENTICATION_REQUIRED",
    );
  }
  const context = await loadCurrentRightsContext(scope, personaId);
  assertExpectedIdentity(context, input);

  if (
    input.decision === "confirmed" &&
    RIGHTS_CONFIRMATION_KEYS.some((key) => input.confirmations[key] !== true)
  ) {
    throw new PersonaDomainError(
      "Every reference-rights confirmation must be explicitly accepted.",
      "WORKFLOW",
    );
  }
  if (input.decision === "rejected" && !input.rejectionReason?.trim()) {
    throw new PersonaDomainError(
      "A rejection reason is required.",
      "WORKFLOW",
    );
  }

  const decidedAt = new Date().toISOString();
  const payload = referenceRightsEvidencePayloadSchema.parse({
    evidenceVersion: REFERENCE_RIGHTS_EVIDENCE_VERSION,
    scope: REFERENCE_RIGHTS_CONFIRMATION_SCOPE,
    decision: input.decision,
    operationId: input.operationId,
    workspaceId: scope.workspaceId,
    personaId,
    identityLockSnapshotId: context.lockedIdentity.identityLockSnapshotId,
    identityLockVersion: context.lockedIdentity.lockVersion,
    identityFingerprint: context.lockedIdentity.identityFingerprint,
    masterReferenceAssetId: context.lockedIdentity.masterReference.id,
    canonicalReferenceAssetIds:
      context.lockedIdentity.canonicalReferences.map(
        (entry) => entry.reference.id,
      ),
    confirmations: input.confirmations,
    decidedBy: scope.actorId,
    decidedAt,
    rejectionReason:
      input.decision === "rejected" ? input.rejectionReason!.trim() : null,
  });
  const repository = getReferenceRightsEvidenceRepository();
  const existing = await repository.getByOperationId(scope, input.operationId);
  if (existing) validateExistingEvidence(existing, payload);
  const evidence = existing ?? (await repository.create(scope, payload));

  if (input.decision === "confirmed") {
    // Re-resolve after evidence persistence so a lock revision cannot silently
    // receive a decision made against an older package.
    const current = await loadCurrentRightsContext(scope, personaId);
    assertExpectedIdentity(current, input);
    for (const entry of current.assets) {
      if (entry.asset.rights_confirmed) continue;
      await getPersonaRepository().updateReferenceAsset(scope, entry.asset.id, {
        rights_confirmed: true,
      });
    }
  }

  const rights = await getReferenceRightsView(scope, personaId);
  const refreshedPersona = await getPersonaRepository().getPersona(scope, personaId);
  const refreshedLock = await resolveLockedBrandIdentity(scope, personaId);
  if (!refreshedPersona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  const eligibility = evaluateBrandModelEligibility({
    persona: refreshedPersona,
    lockedIdentity: refreshedLock,
  });
  return {
    decision: input.decision,
    evidence,
    rights,
    imageEligible: eligibility.imageEligible,
    videoEligible: eligibility.videoEligible,
    providerCalled: false,
  };
}
