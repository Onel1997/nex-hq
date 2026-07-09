/**
 * Brand Vision — north star, positioning, cultural identity, audience.
 */

export interface BrandPillar {
  name: string;
  description: string;
}

export interface AudienceSegment {
  name: string;
  description: string;
  demographics?: string;
  psychographics?: string;
  geography?: string[];
  tags?: string[];
}

export interface BrandVisionContent {
  kind: "brand_vision";
  mission?: string;
  vision?: string;
  positioning?: string;
  northStar?: string;
  pillars?: BrandPillar[];
  voiceTone?: string;
  culturalIdentity?: string;
  audienceSegments?: AudienceSegment[];
}
