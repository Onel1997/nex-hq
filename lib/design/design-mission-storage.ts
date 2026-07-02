import type { DesignConcept, RenderPlan } from "@/lib/design/ai-designer/types";
import type {
  DesignMissionAssets,
  DesignMissionState,
  DesignPromptOverrides,
  PerDesignWorkspace,
} from "@/lib/design/design-mission-store";

export const MAX_PERSISTED_STRING_LENGTH = 50_000;
const MAX_CHAT_MESSAGES_NORMAL = 40;
const MAX_CHAT_MESSAGES_AGGRESSIVE = 12;
const MAX_CHAT_CONTENT_AGGRESSIVE = 2_000;
const MAX_VERSION_HISTORY_AGGRESSIVE = 15;
const MAX_ITERATIONS_AGGRESSIVE = 6;
const MAX_BLUEPRINT_LENGTH = 4_000;

export function isLargeDataUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("data:")) return false;
  return value.length > 256 || isLargeString(value);
}

export function isLargeString(value: unknown): value is string {
  return typeof value === "string" && value.length > MAX_PERSISTED_STRING_LENGTH;
}

function isPersistableUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  if (value.startsWith("data:")) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:")
  );
}

function truncateString(value: string, max = MAX_PERSISTED_STRING_LENGTH): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function sanitizeUrlField(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (isLargeDataUrl(value)) return undefined;
  if (isPersistableUrl(value)) return value;
  return undefined;
}

export function slimConceptForStorage(concept: DesignConcept): DesignConcept {
  return {
    designId: concept.designId,
    title: concept.title,
    collection: concept.collection,
    product: concept.product,
    color: concept.color,
    printArea: concept.printArea,
    designStory: truncateString(concept.designStory, 800),
    confidence: concept.confidence,
    generatedAt: concept.generatedAt,
    creativeDirection: {
      summary: truncateString(concept.creativeDirection.summary, 600),
      mood: concept.creativeDirection.mood,
      emotion: concept.creativeDirection.emotion,
      collectionRole: concept.creativeDirection.collectionRole,
      visualIntent: truncateString(concept.creativeDirection.visualIntent, 400),
      fashionSystem: truncateString(concept.creativeDirection.fashionSystem, 400),
    },
    commercialIntention: {
      role: concept.commercialIntention.role,
      priceBand: concept.commercialIntention.priceBand,
      campaignPotential: concept.commercialIntention.campaignPotential,
      buyerHook: truncateString(concept.commercialIntention.buyerHook, 300),
      wouldBuySignals: concept.commercialIntention.wouldBuySignals.slice(0, 6),
    },
    imagePrompt: {
      primary: truncateString(concept.imagePrompt.primary, 4_000),
      social: truncateString(concept.imagePrompt.social, 1_500),
      campaign: truncateString(concept.imagePrompt.campaign, 2_000),
      tags: concept.imagePrompt.tags.slice(0, 12),
    },
    mockupPrompt: {
      primary: truncateString(concept.mockupPrompt.primary, 4_000),
      flatLay: truncateString(concept.mockupPrompt.flatLay, 1_500),
      onModel: truncateString(concept.mockupPrompt.onModel, 1_500),
      tags: concept.mockupPrompt.tags.slice(0, 12),
    },
    productionNotes: {
      method: concept.productionNotes.method,
      placement: concept.productionNotes.placement,
      dimensions: concept.productionNotes.dimensions,
      colorCount: concept.productionNotes.colorCount,
      materialEffects: truncateString(concept.productionNotes.materialEffects, 300),
      printReadiness: concept.productionNotes.printReadiness.slice(0, 8),
      qualityGates: concept.productionNotes.qualityGates.slice(0, 8),
    },
    fashionLanguage: {
      principles: concept.fashionLanguage.principles.slice(0, 6),
      mood: concept.fashionLanguage.mood,
      stylingNotes: concept.fashionLanguage.stylingNotes.slice(0, 4),
      antiPatterns: concept.fashionLanguage.antiPatterns.slice(0, 4),
      garmentScale: concept.fashionLanguage.garmentScale,
      luxurySignals: concept.fashionLanguage.luxurySignals.slice(0, 4),
    },
    compositionLanguage: {
      pattern: concept.compositionLanguage.pattern,
      focalStrategy: concept.compositionLanguage.focalStrategy,
      balance: concept.compositionLanguage.balance,
      movement: concept.compositionLanguage.movement,
      depthLayers: concept.compositionLanguage.depthLayers,
      overlap: concept.compositionLanguage.overlap,
      hierarchy: concept.compositionLanguage.hierarchy,
      placement: concept.compositionLanguage.placement,
    },
    typographyLanguage: {
      direction: concept.typographyLanguage.direction,
      concepts: concept.typographyLanguage.concepts.slice(0, 4),
      hierarchy: concept.typographyLanguage.hierarchy,
      behaviors: concept.typographyLanguage.behaviors.slice(0, 4),
      compositionShare: concept.typographyLanguage.compositionShare,
      headlineTreatment: concept.typographyLanguage.headlineTreatment,
    },
    symbolLanguage: {
      system: concept.symbolLanguage.system,
      primarySymbols: concept.symbolLanguage.primarySymbols.slice(0, 6),
      secondaryGeometry: concept.symbolLanguage.secondaryGeometry.slice(0, 4),
      restraint: concept.symbolLanguage.restraint,
    },
    ornamentLanguage: {
      system: concept.ornamentLanguage.system,
      elements: concept.ornamentLanguage.elements.slice(0, 4),
      density: concept.ornamentLanguage.density,
      restraint: concept.ornamentLanguage.restraint,
    },
    negativeSpaceProfile: {
      profile: concept.negativeSpaceProfile.profile,
      targetRatio: concept.negativeSpaceProfile.targetRatio,
      rules: concept.negativeSpaceProfile.rules.slice(0, 6),
      breathingZones: concept.negativeSpaceProfile.breathingZones.slice(0, 4),
    },
    heroFocus: {
      focalPoint: concept.heroFocus.focalPoint,
      scrollStopHook: truncateString(concept.heroFocus.scrollStopHook, 300),
      dominantElement: concept.heroFocus.dominantElement,
      supportingElements: concept.heroFocus.supportingElements.slice(0, 4),
    },
  };
}

export function slimRenderPlanForStorage(plan: RenderPlan): RenderPlan {
  return {
    ...plan,
    deliverables: plan.deliverables.slice(0, 8).map((deliverable) => ({
      ...deliverable,
      prompt: truncateString(deliverable.prompt, 2_000),
      notes: deliverable.notes
        ? truncateString(deliverable.notes, 500)
        : deliverable.notes,
    })),
    handoffNotes: plan.handoffNotes.slice(0, 8).map((note) => truncateString(note, 500)),
  };
}

export function sanitizeAssetsForStorage(
  assets: DesignMissionAssets,
  aggressive: boolean,
): DesignMissionAssets {
  const next: DesignMissionAssets = {
    commercialApproved: assets.commercialApproved,
    commercialScore: assets.commercialScore,
    commercialIterations: assets.commercialIterations,
    svgUrl: sanitizeUrlField(assets.svgUrl),
    mockupUrl: sanitizeUrlField(assets.mockupUrl),
    renderUrl: sanitizeUrlField(assets.renderUrl),
  };

  if (!aggressive && assets.imageStudioBlueprint) {
    next.imageStudioBlueprint = truncateString(
      assets.imageStudioBlueprint,
      MAX_BLUEPRINT_LENGTH,
    );
  }

  if (!aggressive && assets.aiDesignerConcept) {
    next.aiDesignerConcept = slimConceptForStorage(assets.aiDesignerConcept);
  }

  if (!aggressive && assets.aiDesignerRenderPlan) {
    next.aiDesignerRenderPlan = slimRenderPlanForStorage(assets.aiDesignerRenderPlan);
  }

  if (!aggressive && assets.aiDesignerReview) {
    next.aiDesignerReview = assets.aiDesignerReview;
  }

  if (!aggressive && assets.masterArtwork) {
    next.masterArtwork = {
      ...assets.masterArtwork,
      approvedSvgMarkup: assets.masterArtwork.approvedSvgMarkup
        ? truncateString(assets.masterArtwork.approvedSvgMarkup)
        : undefined,
    };
  }

  if (!aggressive && assets.svgMarkup && !next.masterArtwork?.approvedSvgMarkup) {
    next.svgMarkup = truncateString(assets.svgMarkup);
  }

  return next;
}

function sanitizePromptOverrides(
  overrides: DesignPromptOverrides,
  aggressive: boolean,
): DesignPromptOverrides {
  const max = aggressive ? 2_000 : 8_000;
  const next: DesignPromptOverrides = {};
  for (const key of ["svgPrompt", "mockupPrompt", "imagePrompt", "designerPrompt"] as const) {
    const value = overrides[key];
    if (typeof value === "string" && value.trim()) {
      next[key] = truncateString(value, max);
    }
  }
  return next;
}

function sanitizeUnknownValue(value: unknown, aggressive: boolean): unknown {
  if (typeof value === "string") {
    if (value.startsWith("data:")) return undefined;
    if (isLargeString(value)) return truncateString(value);
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeUnknownValue(item, aggressive))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    return sanitizeRecord(value as Record<string, unknown>, aggressive);
  }

  return value;
}

function sanitizeRecord<T extends Record<string, unknown>>(
  record: T,
  aggressive: boolean,
): T {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "svgMarkup") continue;
    if (
      (key === "svgUrl" || key === "mockupUrl" || key === "renderUrl") &&
      typeof value === "string"
    ) {
      const sanitized = sanitizeUrlField(value);
      if (sanitized) next[key] = sanitized;
      continue;
    }
    const sanitized = sanitizeUnknownValue(value, aggressive);
    if (sanitized !== undefined) next[key] = sanitized;
  }
  return next as T;
}

export interface SanitizeMissionOptions {
  aggressive?: boolean;
}

export function sanitizeMissionForStorage(
  state: DesignMissionState,
  options: SanitizeMissionOptions = {},
): DesignMissionState {
  const aggressive = options.aggressive ?? false;

  const sanitizedAssets = sanitizeAssetsForStorage(state.assets, aggressive);
  const sanitizedPromptOverrides = sanitizePromptOverrides(
    state.promptOverrides,
    aggressive,
  );

  const designWorkspaces = Object.fromEntries(
    Object.entries(state.designWorkspaces).map(([designId, workspace]) => {
      const activeIterationId = workspace.activeIterationId;
      const iterations = workspace.iterations
        .slice(0, aggressive ? MAX_ITERATIONS_AGGRESSIVE : workspace.iterations.length)
        .map((iteration) => {
          const keepFullAssets = !aggressive || iteration.id === activeIterationId;
          return {
            ...iteration,
            assets: keepFullAssets
              ? sanitizeAssetsForStorage(iteration.assets, aggressive)
              : {},
            promptOverrides: sanitizePromptOverrides(iteration.promptOverrides, aggressive),
            brief: sanitizeRecord(iteration.brief as unknown as Record<string, unknown>, aggressive) as typeof iteration.brief,
          };
        });

      return [
        designId,
        {
          ...workspace,
          assets: sanitizeAssetsForStorage(workspace.assets, aggressive),
          promptOverrides: sanitizePromptOverrides(workspace.promptOverrides, aggressive),
          iterations,
          chat: workspace.chat
            .slice(aggressive ? -MAX_CHAT_MESSAGES_AGGRESSIVE : -MAX_CHAT_MESSAGES_NORMAL)
            .map((message) => ({
              ...message,
              content: aggressive
                ? truncateString(message.content, MAX_CHAT_CONTENT_AGGRESSIVE)
                : isLargeString(message.content)
                  ? truncateString(message.content)
                  : message.content,
            })),
        } satisfies PerDesignWorkspace,
      ];
    }),
  );

  return sanitizeRecord(
    {
      ...state,
      assets: sanitizedAssets,
      promptOverrides: sanitizedPromptOverrides,
      brief: state.brief,
      allBriefs: state.allBriefs,
      versionHistory: state.versionHistory.slice(
        0,
        aggressive ? MAX_VERSION_HISTORY_AGGRESSIVE : state.versionHistory.length,
      ),
      designWorkspaces,
    } as unknown as Record<string, unknown>,
    aggressive,
  ) as unknown as DesignMissionState;
}

export function estimateMissionStorageBytes(state: DesignMissionState): number {
  try {
    return new TextEncoder().encode(JSON.stringify(state)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.code === 22 ||
    error.code === 1014
  );
}

export function serializeMissionForStorage(
  state: DesignMissionState,
  options: SanitizeMissionOptions = {},
): string {
  return JSON.stringify(sanitizeMissionForStorage(state, options));
}
