export const IMAGE_PAID_GENERATION_ENV =
  "NEXHQ_IMAGE_PAID_GENERATION_ENABLED" as const;

export class ImagePaidGenerationSafetyError extends Error {
  readonly code = "IMAGE_PAID_GENERATION_DISABLED" as const;

  constructor() {
    super(
      "Paid Image generation is disabled. NexHQ still requires a durable, scoped confirmation and idempotent job boundary before live execution.",
    );
    this.name = "ImagePaidGenerationSafetyError";
  }
}

/**
 * Defense-in-depth master switch. This is not itself sufficient human consent;
 * it defaults closed until Image receives a durable paid-job confirmation flow.
 */
export function assertImagePaidGenerationEnabled(
  environment: Record<string, string | undefined> = process.env,
): void {
  if (environment[IMAGE_PAID_GENERATION_ENV] !== "true") {
    throw new ImagePaidGenerationSafetyError();
  }
}
