"use client";

const STORAGE_KEY = "nexhq-image-studio-handoff";

export interface ImageStudioHandoff {
  brief: string;
  sourceTitle?: string;
  designId?: string;
  reportId?: string;
  handoffAt: string;
  /** Full blueprint from Commercial Design Director for Image Studio. */
  commercialBlueprint?: string;
  commercialScore?: number;
  commercialApproved?: boolean;
}

export function saveImageStudioHandoff(handoff: ImageStudioHandoff): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
}

export function loadImageStudioHandoff(): ImageStudioHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImageStudioHandoff;
    if (!parsed?.brief?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function consumeImageStudioHandoff(): ImageStudioHandoff | null {
  const handoff = loadImageStudioHandoff();
  if (!handoff) return null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  return handoff;
}
