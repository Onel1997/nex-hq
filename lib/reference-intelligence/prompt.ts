import {
  buildReferenceDirection,
  sanitizeReferencePromptDirection,
} from "./rules";
import type {
  ReferenceDirection,
  ReferenceUsage,
  ReferenceWorkspaceCatalog,
} from "./types";

function joinLines(lines: string[]): string {
  return lines.length > 0 ? lines.join("\n") : "(no approved abstract descriptors)";
}

function sanitizeLines(lines: string[]): string[] {
  return lines
    .map((line) => sanitizeReferencePromptDirection(line).text)
    .filter((line) => line.trim().length > 0);
}

/**
 * Full Reference Intelligence overview for studio system prompts.
 * Never instructs copying images, brands, faces, logos, or compositions.
 */
export function formatReferenceIntelligencePrompt(
  catalog: ReferenceWorkspaceCatalog,
): string {
  const boardLines = catalog.boards
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => {
      const approved = catalog.assets.filter(
        (a) => a.boardId === b.id && a.approvalStatus === "approved",
      ).length;
      return `- ${b.name} [${b.id}] usage=${b.primaryUsage} approved=${approved}`;
    });

  return [
    "## REFERENCE INTELLIGENCE",
    "",
    `Version:\n${catalog.version}`,
    "",
    "Abstraction rule: extract lighting, camera, pose family, expression family, silhouette, color mood, environment type, texture, grain, energy — never copy images, people, logos, or artwork.",
    "",
    `Vision extraction enabled:\n${catalog.visionExtractionEnabled}`,
    "",
    "Boards:",
    ...boardLines,
    "",
    "Hard rules:",
    "- Never say copy, recreate exactly, identical to, same composition, same person, same logo, clone, or replicate.",
    "- Never imitate a source brand campaign by name.",
    "- Only approved references may affect production prompts.",
    "- Draft, rejected, and archived references must be ignored.",
  ].join("\n");
}

function formatDirectionBlock(
  title: string,
  direction: ReferenceDirection,
  extraRules: string[],
): string {
  const lines = sanitizeLines(direction.abstractLines);
  return [
    title,
    "",
    joinLines(lines),
    "",
    ...extraRules,
  ].join("\n");
}

/** Persona Stage A — casting mood only; no campaign locations or product mockups. */
export function formatPersonaReferenceDirection(
  catalog: ReferenceWorkspaceCatalog,
): string {
  const direction = buildReferenceDirection(catalog, "persona_casting");
  if (direction.abstractLines.length === 0) {
    return "";
  }

  return formatDirectionBlock(
    "4B. APPROVED PERSONA CASTING REFERENCE DIRECTION (abstract only)",
    direction,
    [
      "Use only abstract casting cues above.",
      "Never reproduce any reference image, person, logo, garment graphic, or composition.",
      "Do not invent campaign locations, product mockups, or complex scenes from references.",
    ],
  );
}

/** Future Image Studio — not wired to live generation. */
export function formatImageCampaignReferenceDirection(
  catalog: ReferenceWorkspaceCatalog,
): string {
  const direction = buildReferenceDirection(catalog, "image_campaign");
  return formatDirectionBlock(
    "## IMAGE CAMPAIGN REFERENCE DIRECTION (future)",
    direction,
    [
      "Abstract campaign energy only — never copy source campaigns or brand compositions.",
      "Not integrated into live generation yet.",
    ],
  );
}

/** Future Video Studio — not wired to live generation. */
export function formatVideoCampaignReferenceDirection(
  catalog: ReferenceWorkspaceCatalog,
): string {
  const direction = buildReferenceDirection(catalog, "video_campaign");
  return formatDirectionBlock(
    "## VIDEO CAMPAIGN REFERENCE DIRECTION (future)",
    direction,
    [
      "Abstract motion / energy cues only — never clone footage or identities.",
      "Not integrated into live generation yet.",
    ],
  );
}

/** Future product art — not wired to live generation. */
export function formatProductArtReferenceDirection(
  catalog: ReferenceWorkspaceCatalog,
): string {
  const direction = buildReferenceDirection(catalog, "product_art");
  return formatDirectionBlock(
    "## PRODUCT ART REFERENCE DIRECTION (future)",
    direction,
    [
      "Abstract texture / silhouette / color mood only — never copy artwork or logos.",
      "Not integrated into live generation yet.",
    ],
  );
}

export function formatReferenceDirectionForUsage(
  catalog: ReferenceWorkspaceCatalog,
  usage: ReferenceUsage,
): string {
  switch (usage) {
    case "persona_casting":
      return formatPersonaReferenceDirection(catalog);
    case "image_campaign":
      return formatImageCampaignReferenceDirection(catalog);
    case "video_campaign":
      return formatVideoCampaignReferenceDirection(catalog);
    case "product_art":
      return formatProductArtReferenceDirection(catalog);
    default: {
      const direction = buildReferenceDirection(catalog, usage);
      return formatDirectionBlock(
        `## REFERENCE DIRECTION (${usage})`,
        direction,
        ["Abstract descriptors only — never copy source media."],
      );
    }
  }
}
