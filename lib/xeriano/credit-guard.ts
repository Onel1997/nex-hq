import "server-only";
import type { XerianoAccountContext } from "./auth";

export type XerianoGenerationAuthorization =
  | { allowed: true; bypass: "OWNER" }
  | { allowed: true; bypass: null; requiresCreditReservation: true }
  | { allowed: false; code: "CUSTOMER_ACCOUNT_REQUIRED"; status: 403; message: string };

export function authorizeXerianoGeneration(context: XerianoAccountContext): XerianoGenerationAuthorization {
  if (context.role === "OWNER") return { allowed: true, bypass: context.role };
  if (context.role === "CUSTOMER" && context.source === "XERIANO_MEMBERSHIP") {
    return { allowed: true, bypass: null, requiresCreditReservation: true };
  }
  return {
    allowed: false,
    code: "CUSTOMER_ACCOUNT_REQUIRED",
    status: 403,
    message: "Für diese Generierung ist ein aktives Kundenkonto erforderlich.",
  };
}
