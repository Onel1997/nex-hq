import { ApiError } from "@fal-ai/client";

import type {
  UgcVideoGenerationSetup,
  UgcVideoResult,
} from "@/lib/ugc-video-studio/contracts";
import { sanitizeFalProviderError } from "@/lib/ugc-video-studio/provider-diagnostics";
import {
  UgcVideoProviderDiagnosticError,
  UgcVideoProviderSubmitUnknownOutcomeError,
  type UgcVideoProvider,
  type UgcVideoProviderQueueHandle,
  type UgcVideoProviderReference,
  type UgcVideoProviderRequest,
  type UgcVideoProviderResponse,
  type UgcVideoProviderStatus,
  type UgcVideoProviderSubmission,
} from "@/lib/ugc-video-studio/provider";
import {
  createFalVideoEditTransport,
  type FalVideoEditOutput,
  type FalVideoEditTransport,
} from "@/lib/ugc-video-studio/providers/fal-video-edit";
import {
  assertUgcVideoRecastSetup,
  assertUgcVideoRecastUserPrompt,
  KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
  requireUgcVideoRecastSettings,
} from "@/lib/ugc-video-studio/video-recast-config";

export type FalVideoRecastInput = {
  prompt: string;
  video_url: string;
  keep_audio: boolean;
  shot_type: "customize";
  elements: [
    {
      frontal_image_url: string;
      reference_image_urls: [string];
    },
  ];
  image_urls?: [string];
};

export type FalVideoRecastTransport = {
  uploadReference(reference: UgcVideoProviderReference): Promise<string>;
  submit(
    endpoint: typeof KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
    input: FalVideoRecastInput,
  ): ReturnType<FalVideoEditTransport["submit"]>;
  status(
    endpoint: typeof KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
    requestId: string,
    queueHandle?: UgcVideoProviderQueueHandle | null,
  ): Promise<UgcVideoProviderStatus>;
  result(
    endpoint: typeof KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
    requestId: string,
    queueHandle?: UgcVideoProviderQueueHandle | null,
  ): Promise<{ requestId: string; data: FalVideoEditOutput }>;
};

export function createFalVideoRecastTransport(
  credentials: string,
  fetcher: typeof fetch = fetch,
): FalVideoRecastTransport {
  const sharedQueue = createFalVideoEditTransport(credentials, fetcher);
  return {
    uploadReference: (reference) => sharedQueue.uploadReference(reference),
    submit: (endpoint, input) => sharedQueue.submit(endpoint, input),
    status: (endpoint, requestId, queueHandle) =>
      sharedQueue.status(endpoint, requestId, queueHandle),
    result: (endpoint, requestId, queueHandle) =>
      sharedQueue.result(endpoint, requestId, queueHandle),
  };
}

function referenceById(
  references: UgcVideoProviderReference[],
  id: string,
): UgcVideoProviderReference {
  const reference = references.find((item) => item.metadata.id === id);
  if (!reference) throw new Error("UGC_VIDEO_RECAST_REFERENCE_REQUIRED");
  return reference;
}

export function buildVideoRecastPrompt(input: {
  userInstruction: string;
  hasSceneStyle: boolean;
}): string {
  assertUgcVideoRecastUserPrompt(input.userInstruction);
  const canonical = [
    "@Video1 is the sole authority for natural body motion, normal playback speed, timing, cuts, camera behavior, camera angles, framing, perspective and spatial movement direction.",
    "Rebuild the main person as @Element1.",
    "Preserve the identity, natural anatomy, body proportions, complete outfit, oversized garment fit and visible artwork from @Element1.",
    ...(input.hasSceneStyle
      ? [
          "Use @Image1 only for location, lighting, color treatment and visual atmosphere.",
        ]
      : []),
    "Rebuild the scene as a new original production while retaining the source performance and edit rhythm.",
    "Do not copy unrelated people, brands, watermarks or text from the source.",
    "Do not invent gestures, poses, shirt touching or product presentation.",
    "Do not add slow motion, speed ramps, floating motion or artificial blinking.",
    "Do not place hands, hair, bags or objects over the shirt artwork.",
    "Keep fabric behavior, face, hands and walking motion natural.",
    "Do not add extra people unless explicitly requested.",
  ];
  return `${canonical.join("\n")}\n\nAdditional creative direction (without overriding Xeriamo's source and reference authority):\n${input.userInstruction.trim()}`;
}

export function buildFalVideoRecastInput(input: {
  setup: UgcVideoGenerationSetup;
  sourceVideoUrl: string;
  characterOutfitUrl: string;
  faceUrl: string | null;
  sceneStyleUrl: string | null;
}): FalVideoRecastInput {
  assertUgcVideoRecastSetup(input.setup);
  const settings = requireUgcVideoRecastSettings(input.setup);
  return {
    video_url: input.sourceVideoUrl,
    prompt: buildVideoRecastPrompt({
      userInstruction: input.setup.prompt,
      hasSceneStyle: Boolean(input.sceneStyleUrl),
    }),
    keep_audio: settings.keepAudio,
    shot_type: "customize",
    elements: [
      {
        frontal_image_url: input.characterOutfitUrl,
        reference_image_urls: [
          input.faceUrl ?? input.characterOutfitUrl,
        ],
      },
    ],
    ...(input.sceneStyleUrl ? { image_urls: [input.sceneStyleUrl] } : {}),
  };
}

function normalizeResult(input: {
  output: FalVideoEditOutput;
  requestId: string;
  setup: UgcVideoGenerationSetup;
}): UgcVideoResult {
  const settings = requireUgcVideoRecastSettings(input.setup);
  return {
    id: `${input.requestId}-video`,
    url: input.output.video.url,
    downloadUrl: input.output.video.url,
    mimeType: input.output.video.content_type ?? "video/mp4",
    width: null,
    height: null,
    durationSeconds:
      settings.sourceDurationSeconds ?? Number(input.setup.duration),
    byteLength: input.output.video.file_size ?? null,
    favorite: false,
    provider: "fal",
    providerModel: KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
    providerRequestId: input.requestId,
  };
}

export class FalVideoRecastProvider implements UgcVideoProvider {
  readonly providerId = "fal" as const;

  constructor(
    private readonly credentials: string | undefined = process.env.FAL_KEY,
    private readonly transport: FalVideoRecastTransport | null = null,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.transport || this.credentials?.trim());
  }

  private transportInstance(): FalVideoRecastTransport {
    if (!this.isConfigured()) throw new Error("FAL_KEY ist nicht eingerichtet.");
    return (
      this.transport ??
      createFalVideoRecastTransport(this.credentials!.trim())
    );
  }

  async submit(
    request: UgcVideoProviderRequest,
  ): Promise<UgcVideoProviderSubmission> {
    const selected = assertUgcVideoRecastSetup(request.setup);
    const sourceVideo = referenceById(
      request.references,
      selected.sourceVideo.id,
    );
    const characterOutfit = referenceById(
      request.references,
      selected.characterOutfit.id,
    );
    const face = selected.face
      ? referenceById(request.references, selected.face.id)
      : null;
    const sceneStyle = selected.sceneStyle
      ? referenceById(request.references, selected.sceneStyle.id)
      : null;
    const references = [sourceVideo, characterOutfit, face, sceneStyle].filter(
      (reference): reference is UgcVideoProviderReference => Boolean(reference),
    );
    let urls: string[];
    try {
      urls = await Promise.all(
        references.map((reference) =>
          reference.providerUrl
            ? Promise.resolve(reference.providerUrl)
            : this.transportInstance().uploadReference(reference),
        ),
      );
    } catch (error) {
      throw new UgcVideoProviderDiagnosticError(
        sanitizeFalProviderError({
          error,
          phase: "SUBMIT",
          endpoint: KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
          requestId: null,
        }),
        true,
      );
    }
    const urlById = new Map(
      references.map((reference, index) => [reference.metadata.id, urls[index]!]),
    );
    const providerPrompt = buildVideoRecastPrompt({
      userInstruction: request.setup.prompt,
      hasSceneStyle: Boolean(sceneStyle),
    });
    const payload = buildFalVideoRecastInput({
      setup: request.setup,
      sourceVideoUrl: urlById.get(sourceVideo.metadata.id)!,
      characterOutfitUrl: urlById.get(characterOutfit.metadata.id)!,
      faceUrl: face ? urlById.get(face.metadata.id)! : null,
      sceneStyleUrl: sceneStyle ? urlById.get(sceneStyle.metadata.id)! : null,
    });
    try {
      const submitted = await this.transportInstance().submit(
        KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
        payload,
      );
      if (!submitted.statusUrl || !submitted.responseUrl) {
        throw new Error("UGC_VIDEO_RECAST_QUEUE_HANDLE_INCOMPLETE");
      }
      return {
        provider: "fal",
        providerModel: KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
        providerRequestId: submitted.requestId,
        providerPrompt,
        referenceOrder: references.map((reference) => reference.metadata.id),
        providerStatus: "IN_QUEUE",
        statusUrl: submitted.statusUrl,
        responseUrl: submitted.responseUrl,
        cancelUrl: submitted.cancelUrl,
        queuePosition: submitted.queuePosition,
      };
    } catch (error) {
      const diagnostic = sanitizeFalProviderError({
        error,
        phase: "SUBMIT",
        endpoint: KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
        requestId: null,
      });
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      ) {
        throw new UgcVideoProviderDiagnosticError(diagnostic, true);
      }
      throw new UgcVideoProviderSubmitUnknownOutcomeError(diagnostic);
    }
  }

  getStatus(
    providerRequestId: string,
    queueHandle?: UgcVideoProviderQueueHandle | null,
  ): Promise<UgcVideoProviderStatus> {
    return this.transportInstance().status(
      KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
      providerRequestId,
      queueHandle,
    );
  }

  async getResult(input: {
    providerRequestId: string;
    setup: UgcVideoGenerationSetup;
    providerPrompt: string;
    referenceOrder: string[];
    queueHandle?: UgcVideoProviderQueueHandle | null;
  }): Promise<UgcVideoProviderResponse> {
    const response = await this.transportInstance().result(
      KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
      input.providerRequestId,
      input.queueHandle,
    );
    return {
      provider: "fal",
      providerModel: KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
      providerRequestId: input.providerRequestId,
      providerPrompt: input.providerPrompt,
      referenceOrder: input.referenceOrder,
      result: normalizeResult({
        output: response.data,
        requestId: input.providerRequestId,
        setup: input.setup,
      }),
      actualCostUsd: null,
    };
  }
}
