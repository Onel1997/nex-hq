/**
 * Phase 2.2A — €0 pre-provider cross-slot diversity validation.
 * Reject/resample locally before any paid provider call.
 */

import {
  hairBeardTriple,
  highLeverageCombinationKey,
  noseJawEyeTriple,
  validateCrossSlotIdentityDiversity,
  type DiscoveryIdentityInstance,
  type DiscoverySlot,
} from "@/lib/persona/identity-blueprints";
import {
  diversityProfileForSlot,
  type DiversityRegionId,
} from "./diversity-profiles";

export type PreProviderDiversityIssue = {
  code:
    | "same_anatomy_fingerprint"
    | "same_high_leverage_combination"
    | "same_face_geometry_jaw_eyes_cluster"
    | "same_nose_jaw_eye_spacing_cluster"
    | "same_hairline_haircut_beard_cluster"
    | "same_diversity_region"
    | "incompatible_neighboring_regions"
    | "cross_slot_validation_failed";
  message: string;
  slots: DiscoverySlot[];
};

export type PreProviderDiversityResult = {
  ok: boolean;
  issues: PreProviderDiversityIssue[];
};

function faceGeometryJawEyesCluster(instance: DiscoveryIdentityInstance): string {
  return [
    instance.faceGeometry,
    instance.jaw,
    instance.eyeShape,
    instance.eyeSpacing,
  ].join("|");
}

export function validatePreProviderCrossSlotDiversity(
  instances: readonly DiscoveryIdentityInstance[],
): PreProviderDiversityResult {
  const issues: PreProviderDiversityIssue[] = [];

  if (instances.length !== 4) {
    issues.push({
      code: "cross_slot_validation_failed",
      message: `Expected 4 L3 instances, got ${instances.length}`,
      slots: instances.map((i) => i.slot),
    });
    return { ok: false, issues };
  }

  const cross = validateCrossSlotIdentityDiversity(instances);
  if (!cross.ok) {
    for (const issue of cross.issues) {
      issues.push({
        code: "cross_slot_validation_failed",
        message: issue.message,
        slots: instances.map((i) => i.slot),
      });
    }
  }

  const byAnatomy = new Map<string, DiscoverySlot[]>();
  const byHl = new Map<string, DiscoverySlot[]>();
  const byFaceJawEyes = new Map<string, DiscoverySlot[]>();
  const byNoseJawEyes = new Map<string, DiscoverySlot[]>();
  const byHair = new Map<string, DiscoverySlot[]>();
  const byRegion = new Map<DiversityRegionId, DiscoverySlot[]>();

  for (const instance of instances) {
    const slot = instance.slot;
    const region = diversityProfileForSlot(slot).regionId;

    pushMap(byAnatomy, instance.anatomyFingerprint, slot);
    pushMap(byHl, highLeverageCombinationKey(instance), slot);
    pushMap(byFaceJawEyes, faceGeometryJawEyesCluster(instance), slot);
    pushMap(byNoseJawEyes, noseJawEyeTriple(instance), slot);
    pushMap(byHair, hairBeardTriple(instance), slot);
    pushMap(byRegion, region, slot);
  }

  collectDupes(byAnatomy, "same_anatomy_fingerprint", "Identical anatomyFingerprint", issues);
  collectDupes(
    byHl,
    "same_high_leverage_combination",
    "High-leverage combination too similar",
    issues,
  );
  collectDupes(
    byFaceJawEyes,
    "same_face_geometry_jaw_eyes_cluster",
    "Same faceGeometry+jaw+eyes cluster",
    issues,
  );
  collectDupes(
    byNoseJawEyes,
    "same_nose_jaw_eye_spacing_cluster",
    "Same nose+jaw+eyeSpacing cluster",
    issues,
  );
  collectDupes(
    byHair,
    "same_hairline_haircut_beard_cluster",
    "Same hairline+haircut+beard cluster",
    issues,
  );
  collectDupes(byRegion, "same_diversity_region", "Same high-leverage diversity region", issues);

  // Neighboring incompatible regions assigned to slots that share HL direction.
  for (const a of instances) {
    const profileA = diversityProfileForSlot(a.slot);
    for (const b of instances) {
      if (a.slot >= b.slot) continue;
      const regionB = diversityProfileForSlot(b.slot).regionId;
      if (!profileA.incompatibleRegions.includes(regionB)) continue;
      if (highLeverageCombinationKey(a) === highLeverageCombinationKey(b)) {
        issues.push({
          code: "incompatible_neighboring_regions",
          message: `Slots ${a.slot}/${b.slot} share HL combination across incompatible regions`,
          slots: [a.slot, b.slot],
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

function pushMap<K>(map: Map<K, DiscoverySlot[]>, key: K, slot: DiscoverySlot): void {
  const list = map.get(key) ?? [];
  list.push(slot);
  map.set(key, list);
}

function collectDupes(
  map: Map<string | DiversityRegionId, DiscoverySlot[]>,
  code: PreProviderDiversityIssue["code"],
  message: string,
  issues: PreProviderDiversityIssue[],
): void {
  for (const [, slots] of map) {
    if (slots.length > 1) {
      issues.push({ code, message, slots: [...slots] });
    }
  }
}

/**
 * Sample/resample until four slots pass local diversity (max attempts).
 * Pure local — €0, no provider.
 */
export function planDiverseDiscoveryCast(input: {
  sampleCast: () => DiscoveryIdentityInstance[];
  maxResamples?: number;
}): {
  instances: DiscoveryIdentityInstance[];
  resampleCount: number;
  result: PreProviderDiversityResult;
} {
  const max = input.maxResamples ?? 24;
  let last: PreProviderDiversityResult = { ok: false, issues: [] };
  let instances: DiscoveryIdentityInstance[] = [];
  for (let i = 0; i <= max; i++) {
    instances = input.sampleCast();
    last = validatePreProviderCrossSlotDiversity(instances);
    if (last.ok) {
      return { instances, resampleCount: i, result: last };
    }
  }
  return { instances, resampleCount: max, result: last };
}
