import {
  XERIANO_STRIPE_PLAN_CODES,
  type XerianoStripePlanCode,
} from "./billing-product-codes";
import { resolveActiveXerianoPlan } from "./plans";

export type XerianoPlanIntent = XerianoStripePlanCode;

export type XerianoPlanIntentPresentation = {
  productCode: XerianoPlanIntent;
  planCode: "CREATOR" | "PRO" | "STUDIO" | "MAX";
  name: string;
  grossPriceMinor: number;
  grantedCredits: number;
};

export function parseXerianoPlanIntent(value: unknown): XerianoPlanIntent | null {
  if (typeof value !== "string") return null;
  return XERIANO_STRIPE_PLAN_CODES.includes(value as XerianoStripePlanCode)
    ? value as XerianoStripePlanCode
    : null;
}

export function getXerianoPlanIntentPresentation(
  value: unknown,
): XerianoPlanIntentPresentation | null {
  const productCode = parseXerianoPlanIntent(value);
  if (!productCode) return null;
  const planCode = productCode.slice(0, -"_MONTHLY".length) as XerianoPlanIntentPresentation["planCode"];
  const plan = resolveActiveXerianoPlan(planCode);
  if (!plan || plan.code === "FREE" || plan.billingInterval !== "MONTHLY") return null;
  return {
    productCode,
    planCode,
    name: plan.name,
    grossPriceMinor: plan.grossPriceMinor,
    grantedCredits: plan.grantedCredits,
  };
}

export function withXerianoPlanIntent(
  pathname: "/login" | "/register" | "/reset-password" | "/app/credits",
  value: unknown,
  extra?: Readonly<Record<string, string>>,
): string {
  const params = new URLSearchParams(extra);
  const plan = parseXerianoPlanIntent(value);
  if (plan) params.set("plan", plan);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Auth callbacks only accept destinations Xeriano itself emits. This is kept
 * deliberately narrow: it is not a general-purpose redirect validator.
 */
export function sanitizeXerianoAuthDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/app";
  let parsed: URL;
  try {
    parsed = new URL(value, "https://auth.xeriano.invalid");
  } catch {
    return "/app";
  }
  if (parsed.origin !== "https://auth.xeriano.invalid") return "/app";

  if (parsed.pathname === "/app") return "/app";
  if (parsed.pathname === "/app/credits") {
    return withXerianoPlanIntent("/app/credits", parsed.searchParams.get("plan"));
  }
  if (parsed.pathname === "/reset-password" && parsed.searchParams.get("mode") === "update") {
    return withXerianoPlanIntent(
      "/reset-password",
      parsed.searchParams.get("plan"),
      { mode: "update" },
    );
  }
  return "/app";
}
