import type { DesignGenerationSetup } from "@/lib/design-studio/contracts";
import type { DesignEndpoint } from "@/lib/design-studio/model-config";

export type DesignProviderReference = { bytes: Buffer; mimeType: string; name: string };
export type DesignProviderResult = { url: string; mimeType: string; width: number | null; height: number | null };
export type DesignProviderQueueHandle = {
  requestId: string;
  endpoint: DesignEndpoint;
  statusUrl: string;
  responseUrl: string;
  cancelUrl: string | null;
};
export type DesignProviderResponse = {
  providerModel: DesignEndpoint;
  providerRequestId: string;
  providerPrompt: string;
  results: DesignProviderResult[];
};
export interface DesignProvider {
  isConfigured(): boolean;
  generate(input: {
    jobId: string;
    setup: DesignGenerationSetup;
    reference: DesignProviderReference | null;
    onAccepted?: (
      requestId: string,
      endpoint: DesignEndpoint,
      queueHandle?: DesignProviderQueueHandle,
    ) => Promise<void> | void;
  }): Promise<DesignProviderResponse>;
  /**
   * Re-observes a previously accepted provider request without submitting it
   * again. `null` means the provider still owns an in-flight request.
   */
  recover?(input: {
    setup: DesignGenerationSetup;
    providerRequestId: string;
    providerModel: DesignEndpoint;
    providerPrompt: string;
    providerQueueHandle?: DesignProviderQueueHandle | null;
  }): Promise<DesignProviderResponse | null>;
}

export class DesignProviderUnknownOutcomeError extends Error {
  constructor(readonly requestId: string, readonly endpoint: DesignEndpoint) {
    super("Der Anbieterstatus ist nach der Übermittlung nicht eindeutig.");
    this.name = "DesignProviderUnknownOutcomeError";
  }
}
