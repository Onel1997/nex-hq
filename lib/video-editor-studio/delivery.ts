import "server-only";

import { NextResponse } from "next/server";

import { requireEnv } from "@/lib/config/env";

export function videoEditorStorageRedirect(signedUrl: string) {
  const signed = new URL(signedUrl);
  const configured = new URL(requireEnv("NEXT_PUBLIC_SUPABASE_URL"));
  if (
    signed.protocol !== "https:" || signed.hostname !== configured.hostname ||
    signed.username || signed.password || signed.port || signed.hash ||
    !signed.pathname.includes("/storage/v1/object/sign/")
  ) throw new Error("VIDEO_EDITOR_STORAGE_URL_INVALID");
  const response = NextResponse.redirect(signed, 307);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
