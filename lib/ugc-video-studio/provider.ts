import type {
  UgcVideoGenerationSetup,
  UgcVideoProviderError,
  UgcVideoQueueObservation,
  UgcVideoReferenceMetadata,
  UgcVideoResult,
} from "@/lib/ugc-video-studio/contracts";

export type UgcVideoProviderReference = {
  metadata: UgcVideoReferenceMetadata;
  bytes: Buffer;
};

export type UgcVideoProviderRequest = {
  clientRequestId: string;
  endUserId: string;
  setup: UgcVideoGenerationSetup;
  references: UgcVideoProviderReference[];
};

export type UgcVideoProviderSubmission = {
  provider: string;
  providerModel: string;
  providerRequestId: string;
  providerPrompt: string;
  referenceOrder: string[];
  providerStatus: "IN_QUEUE" | "IN_PROGRESS";
  statusUrl: string | null;
  responseUrl: string | null;
  cancelUrl: string | null;
  queuePosition: number | null;
};

export type UgcVideoProviderStatus = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  queuePosition: number | null;
  error: string | null;
  logs: UgcVideoQueueObservation["logs"];
  inferenceTimeSeconds: number | null;
  metrics: string | null;
  truncated: boolean;
};

export class UgcVideoProviderDiagnosticError extends Error {
  constructor(
    readonly diagnostic: UgcVideoProviderError,
    readonly terminal: boolean,
  ) {
    super(diagnostic.providerMessage);
    this.name = "UgcVideoProviderDiagnosticError";
  }
}

export class UgcVideoProviderSubmitUnknownOutcomeError extends Error {
  readonly code = "UGC_VIDEO_PROVIDER_UNKNOWN_OUTCOME" as const;

  constructor(readonly diagnostic: UgcVideoProviderError) {
    super("Der Anbieterstatus ist unklar. Es wird kein neuer Auftrag gestartet.");
    this.name = "UgcVideoProviderSubmitUnknownOutcomeError";
  }
}

export type UgcVideoProviderResponse = {
  provider: string;
  providerModel: string;
  providerRequestId: string;
  providerPrompt: string;
  referenceOrder: string[];
  result: UgcVideoResult;
  actualCostUsd: number | null;
};

export interface UgcVideoProvider {
  readonly providerId: string;
  isConfigured(): boolean;
  submit(request: UgcVideoProviderRequest): Promise<UgcVideoProviderSubmission>;
  getStatus(providerRequestId: string): Promise<UgcVideoProviderStatus>;
  getResult(input: {
    providerRequestId: string;
    setup: UgcVideoGenerationSetup;
    providerPrompt: string;
    referenceOrder: string[];
  }): Promise<UgcVideoProviderResponse>;
}
