import { CONTENT_REPORT_TYPE } from "@/brain/domains/reports";
import { z } from "zod";

export const CONTENT_REPORT_TYPE_VALUE = CONTENT_REPORT_TYPE;

const detailedString = (min: number) => z.string().min(min);
const bulletList = (min: number, max: number) =>
  z.array(z.string().min(15)).min(min).max(max);
const captionList = (min: number, max: number) =>
  z.array(z.string().min(20)).min(min).max(max);

export const contentLandingPageCopySchema = z.object({
  heroHeadline: z.string().min(5).max(80),
  heroSubheadline: z.string().min(10).max(160),
  brandStory: detailedString(80),
  collectionIntroduction: detailedString(60),
  cta: z.string().min(3).max(60),
});

export const contentProductCopySchema = z.object({
  productName: z.string().min(1),
  shortDescription: z.string().min(20).max(300),
  longDescription: detailedString(80),
  featureBullets: bulletList(3, 8),
  seoCopy: z.string().min(50).max(320),
});

export const contentEmailSequenceSchema = z.object({
  teaserEmail: detailedString(80),
  revealEmail: detailedString(100),
  countdownEmail: detailedString(80),
  launchEmail: detailedString(100),
});

export const contentSocialContentSchema = z.object({
  instagramCaptions: captionList(10, 20),
  tiktokHooks: captionList(10, 20),
  storyIdeas: bulletList(5, 15),
  launchPosts: bulletList(4, 10),
});

export const contentSmsCampaignSchema = z.object({
  teaserSms: z.string().min(20).max(160),
  countdownSms: z.string().min(20).max(160),
  launchSms: z.string().min(20).max(160),
});

export const contentOutputSchema = z.object({
  title: z.string().min(1),
  reportType: z.literal(CONTENT_REPORT_TYPE),
  brandNarrative: detailedString(120),
  landingPageCopy: contentLandingPageCopySchema,
  productCopy: z.array(contentProductCopySchema).min(1).max(24),
  emailSequence: contentEmailSequenceSchema,
  socialContent: contentSocialContentSchema,
  smsCampaign: contentSmsCampaignSchema,
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(1),
  fullContent: z.string().min(800),
});

export type ContentLandingPageCopy = z.infer<typeof contentLandingPageCopySchema>;
export type ContentProductCopy = z.infer<typeof contentProductCopySchema>;
export type ContentEmailSequence = z.infer<typeof contentEmailSequenceSchema>;
export type ContentSocialContent = z.infer<typeof contentSocialContentSchema>;
export type ContentSmsCampaign = z.infer<typeof contentSmsCampaignSchema>;
export type ContentOutput = z.infer<typeof contentOutputSchema>;

export interface ContentRunInput {
  brief: string;
  workspaceId: string;
  workspaceName: string;
  originTaskId?: string;
}

export interface ContentRunResult {
  reportId: string;
  reportRecordId: string;
  title: string;
  brandNarrative: string;
  landingPageCopy: ContentLandingPageCopy;
  productCopy: ContentProductCopy[];
  emailSequence: ContentEmailSequence;
  socialContent: ContentSocialContent;
  smsCampaign: ContentSmsCampaign;
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}
