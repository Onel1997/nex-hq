"use client";

import { cn } from "@/lib/utils";

export type PersonaChipTone =
  | "premium"
  | "editorial"
  | "video"
  | "image"
  | "luxury"
  | "commercial"
  | "brand"
  | "approved"
  | "draft"
  | "review"
  | "muted";

const TONE_CLASS: Record<PersonaChipTone, string> = {
  premium: "ps-status-chip--premium",
  editorial: "ps-status-chip--editorial",
  video: "ps-status-chip--video",
  image: "ps-status-chip--image",
  luxury: "ps-status-chip--luxury",
  commercial: "ps-status-chip--commercial",
  brand: "ps-status-chip--brand",
  approved: "ps-status-chip--approved",
  draft: "ps-status-chip--draft",
  review: "ps-status-chip--review",
  muted: "ps-status-chip--muted",
};

export function PersonaStatusChip({
  label,
  tone = "muted",
  className,
}: {
  label: string;
  tone?: PersonaChipTone;
  className?: string;
}) {
  return (
    <span className={cn("ps-status-chip", TONE_CLASS[tone], className)}>{label}</span>
  );
}

export function personaStatusTone(
  status: string,
): PersonaChipTone {
  const s = status.toLowerCase();
  if (s === "approved") return "approved";
  if (s === "draft") return "draft";
  if (s === "review" || s === "in_review") return "review";
  if (s.includes("video")) return "video";
  if (s.includes("image")) return "image";
  return "muted";
}
