/** Runtime validation for the public Persona integration query boundary. */

import { z } from "zod";
import { BRAND_MODEL_CONSUMERS } from "../domain/brand-model-contract";

export const personaIntegrationQuerySchema = z
  .object({
    consumer: z.enum(BRAND_MODEL_CONSUMERS),
    personaId: z.string().min(1).optional(),
    expectedIdentityLockSnapshotId: z.string().min(1).optional(),
    expectedIdentityLockVersion: z.coerce.number().int().positive().optional(),
    expectedIdentityFingerprint: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const expected = [
      value.expectedIdentityLockSnapshotId,
      value.expectedIdentityLockVersion,
      value.expectedIdentityFingerprint,
    ];
    const supplied = expected.filter((entry) => entry !== undefined).length;
    if (supplied !== 0 && supplied !== expected.length) {
      context.addIssue({
        code: "custom",
        message:
          "Expected Identity Lock snapshot, version, and fingerprint must be supplied together.",
      });
    }
    if (supplied > 0 && !value.personaId) {
      context.addIssue({
        code: "custom",
        message:
          "Expected identity may be checked only for a specific Persona.",
      });
    }
  });

export type PersonaIntegrationQuery = z.infer<
  typeof personaIntegrationQuerySchema
>;
