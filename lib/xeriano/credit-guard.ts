import "server-only";
import type { XerianoAccountContext } from "./auth";
import { resolveXerianoGenerationAuthority } from "./access-policy";

export type XerianoGenerationAuthorization =
  | { allowed: true; bypass: "OWNER_UNLIMITED" }
  | { allowed: true; bypass: null; requiresCreditReservation: true }
  | { allowed: false; code: "CUSTOMER_ACCOUNT_REQUIRED"; status: 403; message: string };

export function authorizeXerianoGeneration(context: XerianoAccountContext): XerianoGenerationAuthorization {
  const authority = resolveXerianoGenerationAuthority(context);
  if (authority === "OWNER_UNLIMITED") {
    return { allowed: true, bypass: "OWNER_UNLIMITED" };
  }
  if (authority === "CUSTOMER_CREDITS") {
    return { allowed: true, bypass: null, requiresCreditReservation: true };
  }
  return {
    allowed: false,
    code: "CUSTOMER_ACCOUNT_REQUIRED",
    status: 403,
    message: "Für diese Generierung ist ein aktives Kundenkonto erforderlich.",
  };
}
