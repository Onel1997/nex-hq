import type {
  CreativeGenerationSetup,
  CreativeResult,
} from "@/lib/creative-studio/contracts";
import {
  creativeModelById,
  type CreativeModelDefinition,
} from "@/lib/creative-studio/model-registry";

export type CreativeProviderReference = {
  metadata: CreativeGenerationSetup["references"][number];
  bytes: Buffer;
};

export type CreativeProviderRequest = {
  clientRequestId: string;
  financialMode?: "OWNER" | "CUSTOMER" | "INTERNAL";
  setup: CreativeGenerationSetup;
  references: CreativeProviderReference[];
  onProviderRequestId?: (providerRequestId: string) => Promise<void> | void;
};

export type CreativeProviderResponse = {
  provider: string;
  providerModel: string;
  providerRequestId: string | null;
  providerPrompt: string;
  referenceOrder: string[];
  results: CreativeResult[];
};

export type CreativeProviderRecoveryRequest = {
  clientRequestId: string;
  financialMode?: "OWNER" | "CUSTOMER" | "INTERNAL";
  setup: CreativeGenerationSetup;
  providerRequestId: string;
  providerPrompt: string;
  referenceOrder: string[];
};

export interface CreativeImageProvider {
  readonly providerId: string;
  isConfigured(): boolean;
  generate(request: CreativeProviderRequest): Promise<CreativeProviderResponse>;
  recover?(
    request: CreativeProviderRecoveryRequest,
  ): Promise<CreativeProviderResponse>;
}

export class CreativeProviderNotConnectedError extends Error {
  readonly code = "CREATIVE_PROVIDER_NOT_CONNECTED" as const;

  constructor(readonly model: CreativeModelDefinition) {
    super(
      `${model.name} ist im Creative Studio noch nicht live verbunden. Das Setup bleibt erhalten.`,
    );
    this.name = "CreativeProviderNotConnectedError";
  }
}

/**
 * Provider-neutral execution boundary. The initial Creative Studio ships with
 * a complete registry and honest connection states; no existing Image Studio
 * provider is reused implicitly and no paid call can happen by previewing UI.
 */
export async function executeCreativeGeneration(input: {
  request: CreativeProviderRequest;
  providers: readonly CreativeImageProvider[];
}): Promise<CreativeProviderResponse> {
  const model = creativeModelById(input.request.setup.modelId);
  if (!model) throw new Error("Das ausgewählte Modell ist nicht registriert.");
  const provider = input.providers.find(
    (candidate) => candidate.providerId === model.providerId,
  );
  if (!provider?.isConfigured()) {
    throw new CreativeProviderNotConnectedError(model);
  }
  return provider.generate(input.request);
}
