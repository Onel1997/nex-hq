import type { FashionDesignEngineInput, FashionDesignEngineResult } from "./types";
import { FASHION_ENGINE_VERSION } from "./types";
import { buildResearchHandoffContext } from "./research-handoff";
import {
  advanceFashionEngineProgress,
  createFashionEngineProgress,
  startFashionEngineProgress,
} from "./progress";
import { buildMasterArtworkPromptFromEngine } from "./prompt-builder";
import {
  runArtDirectorAgent,
  runCompositionEngine,
  runCreativeDirectorAgent,
  runFashionCommercialDirectorAgent,
  runGraphicDesignerAgent,
  runPrintProductionAgent,
  runTypographyDesignerAgent,
} from "./agents";

export interface RunFashionDesignEngineOptions {
  generationMode?: "draft" | "production";
  onProgress?: (result: FashionDesignEngineResult) => void;
}

/**
 * Fashion Design Engine — internal multi-agent pipeline.
 *
 * Research Handoff → Creative Director → Art Director → Typography Designer
 * → Graphic Designer → Composition Engine → Commercial Director → Print Production
 *
 * Does not generate images. Returns structured specs + image execution prompt.
 */
export function runFashionDesignEngine(
  input: FashionDesignEngineInput,
  options: RunFashionDesignEngineOptions = {},
): FashionDesignEngineResult {
  let progress = startFashionEngineProgress(createFashionEngineProgress());

  const emit = (partial: Partial<FashionDesignEngineResult>) => {
    if (!options.onProgress) return;
    options.onProgress({
      engineVersion: FASHION_ENGINE_VERSION,
      input: {
        brief: input.brief,
        designDirection: input.designDirection,
        conceptId: input.concept.designId,
        conceptTitle: input.concept.title,
      },
      creativeBrief: partial.creativeBrief!,
      layoutSpec: partial.layoutSpec!,
      typographySpec: partial.typographySpec!,
      graphicSpec: partial.graphicSpec!,
      compositionSpec: partial.compositionSpec!,
      commercialAssessment: partial.commercialAssessment!,
      printSpec: partial.printSpec!,
      imageGenerationPrompt: partial.imageGenerationPrompt ?? "",
      progress,
      completedAt: partial.completedAt ?? new Date().toISOString(),
    });
  };

  // Research Handoff
  const research = buildResearchHandoffContext(input);
  progress = advanceFashionEngineProgress(progress, "research-handoff");

  // Creative Director
  const creativeBrief = runCreativeDirectorAgent({
    brief: input.brief,
    concept: input.concept,
    designDirection: input.designDirection,
    research,
  });
  progress = advanceFashionEngineProgress(progress, "creative-director");
  emit({ creativeBrief } as Partial<FashionDesignEngineResult>);

  // Art Director
  const layoutSpec = runArtDirectorAgent({
    brief: input.brief,
    concept: input.concept,
    creativeBrief,
  });
  progress = advanceFashionEngineProgress(progress, "art-director");
  emit({ creativeBrief, layoutSpec } as Partial<FashionDesignEngineResult>);

  // Typography Designer
  const typographySpec = runTypographyDesignerAgent({
    brief: input.brief,
    concept: input.concept,
    creativeBrief,
    layoutSpec,
  });
  progress = advanceFashionEngineProgress(progress, "typography-designer");
  emit({ creativeBrief, layoutSpec, typographySpec } as Partial<FashionDesignEngineResult>);

  // Graphic Designer
  const graphicSpec = runGraphicDesignerAgent({
    brief: input.brief,
    concept: input.concept,
    creativeBrief,
    layoutSpec,
  });
  progress = advanceFashionEngineProgress(progress, "graphic-designer");
  emit({ creativeBrief, layoutSpec, typographySpec, graphicSpec } as Partial<FashionDesignEngineResult>);

  // Composition Engine
  const compositionSpec = runCompositionEngine({
    brief: input.brief,
    concept: input.concept,
    layoutSpec,
    typographySpec,
    graphicSpec,
  });
  progress = advanceFashionEngineProgress(progress, "composition-engine");
  emit({
    creativeBrief,
    layoutSpec,
    typographySpec,
    graphicSpec,
    compositionSpec,
  } as Partial<FashionDesignEngineResult>);

  // Commercial Director
  const commercialAssessment = runFashionCommercialDirectorAgent({
    brief: input.brief,
    concept: input.concept,
    creativeBrief,
    layoutSpec,
    typographySpec,
    graphicSpec,
    compositionSpec,
  });
  progress = advanceFashionEngineProgress(progress, "commercial-director");
  emit({
    creativeBrief,
    layoutSpec,
    typographySpec,
    graphicSpec,
    compositionSpec,
    commercialAssessment,
  } as Partial<FashionDesignEngineResult>);

  // Print Production
  const printSpec = runPrintProductionAgent({
    brief: input.brief,
    concept: input.concept,
    layoutSpec,
    typographySpec,
    graphicSpec,
    compositionSpec,
    generationMode: options.generationMode,
  });
  progress = advanceFashionEngineProgress(progress, "print-production");

  const result: FashionDesignEngineResult = {
    engineVersion: FASHION_ENGINE_VERSION,
    input: {
      brief: input.brief,
      designDirection: input.designDirection,
      conceptId: input.concept.designId,
      conceptTitle: input.concept.title,
    },
    creativeBrief,
    layoutSpec,
    typographySpec,
    graphicSpec,
    compositionSpec,
    commercialAssessment,
    printSpec,
    imageGenerationPrompt: "",
    progress,
    completedAt: new Date().toISOString(),
  };

  result.imageGenerationPrompt = buildMasterArtworkPromptFromEngine(
    result,
    input.brief,
    input.concept,
  );

  return result;
}
