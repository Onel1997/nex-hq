import "server-only";

import {
  hasXerianoAccountMembership,
  hasXerianoOwnerAuthority,
  resolveXerianoAccess,
  type XerianoAccountContext,
} from "@/lib/xeriano/auth";
import { assessTrustedXeriamoApplicationOrigin } from "@/lib/xeriano/request-origin";

export class VideoEditorAuthorizationError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "VideoEditorAuthorizationError";
  }
}

export async function requireVideoEditorOwner(request?: Request): Promise<XerianoAccountContext> {
  if (request && request.method !== "GET" && request.method !== "HEAD") {
    const origin = assessTrustedXeriamoApplicationOrigin({
      originHeader: request.headers.get("origin"),
      requestUrl: request.url,
      applicationUrl: process.env.NEXT_PUBLIC_APP_URL,
      hostHeader: request.headers.get("host"),
      forwardedHostHeader: request.headers.get("x-forwarded-host"),
      forwardedProtoHeader: request.headers.get("x-forwarded-proto"),
      environment: process.env.NODE_ENV,
    });
    if (!origin.allowed) {
      throw new VideoEditorAuthorizationError(403, "MUTATION_ORIGIN_REQUIRED", "Keine Berechtigung für diese Aktion.");
    }
  }
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") {
    throw new VideoEditorAuthorizationError(401, "AUTHENTICATION_REQUIRED", "Bitte melde dich erneut an.");
  }
  if (
    access.status !== "AUTHENTICATED" ||
    !hasXerianoAccountMembership(access.context) ||
    !hasXerianoOwnerAuthority(access.context)
  ) {
    throw new VideoEditorAuthorizationError(403, "VIDEO_EDITOR_OWNER_ONLY", "Das Video Editor Studio ist derzeit ein OWNER-Pilot.");
  }
  return access.context;
}

