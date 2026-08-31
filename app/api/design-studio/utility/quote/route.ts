import { NextResponse } from "next/server";
import { z } from "zod";
import { DESIGN_UTILITY_OPERATIONS } from "@/lib/design-studio/utility-config";
import { ownerEstimatedCostLabel } from "@/lib/design-studio/owner-cost";
import { hasXerianoAccountMembership, resolveXerianoAccess } from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import { quoteDesignUtilityGeneration } from "@/lib/xeriano/customer-generation";

const requestSchema = z.object({ operation: z.enum(DESIGN_UTILITY_OPERATIONS) }).strict();

export async function POST(request: Request) {
  try {
    const access = await resolveXerianoAccess();
    if (access.status !== "AUTHENTICATED") return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
    if (!hasXerianoAccountMembership(access.context)) return NextResponse.json({ error: "Eine aktive Xeriamo Mitgliedschaft ist erforderlich." }, { status: 403 });
    const authorization = authorizeXerianoGeneration(access.context);
    if (!authorization.allowed) return NextResponse.json({ error: authorization.message }, { status: authorization.status });
    const { operation } = requestSchema.parse(await request.json());
    const quote = quoteDesignUtilityGeneration(operation);
    return NextResponse.json({
      success: true,
      ...(authorization.bypass === "OWNER_UNLIMITED"
        ? { ownerUnlimited: true, ownerCostLabel: ownerEstimatedCostLabel(quote) }
        : { credits: quote.credits }),
      pricingVersion: quote.pricingVersion,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Der Credit-Preis ist gerade nicht verfügbar." }, { status: 400 });
  }
}
