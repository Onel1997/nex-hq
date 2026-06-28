import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { generateDesignSvg } from "@/lib/design/generate-design-svg";

export interface GenerateDesignSvgResult {
  svg: string;
}

export function runGenerateDesignSvg(brief: DesignStudioBrief): GenerateDesignSvgResult {
  const svg = generateDesignSvg(brief);
  if (!svg.trimStart().startsWith("<")) {
    throw new Error("SVG generation produced invalid markup");
  }
  return { svg };
}
