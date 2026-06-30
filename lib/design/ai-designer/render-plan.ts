import type { DesignConcept, RenderDeliverable, RenderPlan } from "@/lib/design/ai-designer/types";

/** Build Image Studio render plan from a DesignConcept blueprint. */
export function buildRenderPlan(concept: DesignConcept): RenderPlan {
  const { imagePrompt, mockupPrompt } = concept;

  const deliverables: RenderDeliverable[] = [
    {
      kind: "concept-visualization",
      prompt: imagePrompt.primary,
      aspectRatio: "4:5",
      priority: "primary",
      notes: "Primary concept visualization — premium fashion artwork on garment",
    },
    {
      kind: "product-mockup",
      prompt: mockupPrompt.primary,
      aspectRatio: "4:5",
      priority: "primary",
      notes: "Product mockup for commercial review",
    },
    {
      kind: "campaign-hero",
      prompt: imagePrompt.campaign,
      aspectRatio: "16:9",
      priority: "secondary",
      notes: "Campaign hero for drop marketing",
    },
    {
      kind: "social-asset-4-5",
      prompt: imagePrompt.social,
      aspectRatio: "4:5",
      priority: "secondary",
      notes: "Instagram feed scroll-stop asset",
    },
    {
      kind: "social-asset-1-1",
      prompt: imagePrompt.social,
      aspectRatio: "1:1",
      priority: "secondary",
      notes: "Square social crop",
    },
    {
      kind: "lookbook-still",
      prompt: mockupPrompt.onModel,
      aspectRatio: "3:4",
      priority: "secondary",
      notes: "Lookbook / Pinterest moodboard compatibility",
    },
  ];

  const pipeline = [
    "AI Designer → DesignConcept blueprint",
    "Image Studio → generate concept visualization",
    "Image Studio → generate product mockup",
    "Commercial Director → evaluate and choose winner",
    "Image Studio → campaign + social deliverables",
    "Shopify → product listing assets",
  ];

  const handoffNotes = [
    `Concept: ${concept.title} (${concept.designId})`,
    `Collection: ${concept.collection} · Role: ${concept.commercialIntention.role}`,
    `Hero focus: ${concept.heroFocus.scrollStopHook}`,
    `Confidence: ${concept.confidence}/100`,
    "Do NOT render SVG — use image prompts for all visual deliverables",
    "Commercial Director selects winning concept before mockup finalization",
  ];

  return {
    conceptId: concept.designId,
    deliverables,
    pipeline,
    handoffNotes,
  };
}
