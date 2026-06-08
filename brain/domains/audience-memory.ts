/**
 * Audience Memory — Creator HQ industry domain.
 */

export interface AudiencePlatform {
  platform: string;
  handle?: string;
  followerCount?: number;
  engagementRate?: number;
}

export interface AudienceSegmentProfile {
  name: string;
  description: string;
  size?: number;
  interests?: string[];
}

export interface AudienceMemoryContent {
  kind: "audience_memory";
  primaryPlatforms: AudiencePlatform[];
  segments: AudienceSegmentProfile[];
  demographics?: string;
  contentPreferences?: string[];
  monetizationChannels?: string[];
}
