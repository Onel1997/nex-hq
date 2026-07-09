import {
  generateOpenAiImage,
  isOpenAiImagesConfigured,
} from "@/agents/image/providers/openai-images-provider";
import {
  buildMockupGenerationPrompt,
  type NormalizedDesignMockupRequest,
} from "@/lib/design/mockup-request";

export interface GenerateDesignMockupResult {
  imageUrl: string;
  prompt: string;
  designId: string;
}

export async function runGenerateDesignMockup(
  request: NormalizedDesignMockupRequest,
): Promise<GenerateDesignMockupResult> {
  if (!isOpenAiImagesConfigured()) {
    throw new Error("OpenAI API key not configured for mockup generation");
  }

  const prompt = buildMockupGenerationPrompt(request);

  const result = await generateOpenAiImage({
    prompt,
    dimensions: "1024x1536",
    assetType: "product_mockup",
    styleNotes: request.productionMethod,
  });

  if (!result.imageBytes) {
    throw new Error("Mockup generation returned no image data");
  }

  const imageUrl = `data:image/png;base64,${result.imageBytes.toString("base64")}`;

  return {
    imageUrl,
    prompt,
    designId: request.designId,
  };
}
