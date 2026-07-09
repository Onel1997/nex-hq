import {
  generateOpenAiImage,
  isOpenAiImagesConfigured,
} from "@/agents/image/providers/openai-images-provider";
import {
  buildRenderGenerationPrompt,
  type NormalizedDesignRenderRequest,
} from "@/lib/design/render-request";

export interface GenerateDesignRenderResult {
  imageUrl: string;
  prompt: string;
  designId: string;
}

export async function runGenerateDesignRender(
  request: NormalizedDesignRenderRequest,
): Promise<GenerateDesignRenderResult> {
  if (!isOpenAiImagesConfigured()) {
    throw new Error("OpenAI API key not configured for AI render generation");
  }

  const prompt = buildRenderGenerationPrompt(request);

  const result = await generateOpenAiImage({
    prompt,
    dimensions: "1536x1024",
    assetType: "editorial_render",
    styleNotes: request.productionMethod,
  });

  if (!result.imageBytes) {
    throw new Error("AI render generation returned no image data");
  }

  const imageUrl = `data:image/png;base64,${result.imageBytes.toString("base64")}`;

  return {
    imageUrl,
    prompt,
    designId: request.designId,
  };
}
