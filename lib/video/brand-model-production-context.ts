/** Video Studio's typed Persona handoff seam. No Video provider is invoked. */

import {
  brandModelHandoffSchema,
  traceBrandModelContract,
  type BrandModelContract,
  type BrandModelHandoff,
  type BrandModelTrace,
} from "@/lib/persona/domain/brand-model-contract";

export type VideoBrandModelProductionContext = {
  contract: BrandModelContract;
  trace: BrandModelTrace;
};

/** Trust the independently derived Persona video eligibility result. */
export function createVideoBrandModelProductionContext(
  input: BrandModelHandoff,
): VideoBrandModelProductionContext {
  const handoff = brandModelHandoffSchema.parse(input);
  if (handoff.consumer !== "video") {
    throw new Error("Image Brand Model handoff cannot be used for video production.");
  }
  if (!handoff.contract.eligibility.videoEligible) {
    throw new Error(
      `Persona authority rejected this Brand Model for video production: ${handoff.contract.eligibility.videoBlockingReasons.join("; ")}`,
    );
  }
  return {
    contract: handoff.contract,
    trace: traceBrandModelContract(handoff.contract),
  };
}
