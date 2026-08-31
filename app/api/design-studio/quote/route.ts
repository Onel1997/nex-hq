import { NextResponse } from "next/server";
import { designGenerationSetupSchema } from "@/lib/design-studio/contracts";
import { hasXerianoAccountMembership, resolveXerianoAccess } from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import { quoteDesignCustomerGeneration } from "@/lib/xeriano/customer-generation";
import { ownerEstimatedCostLabel } from "@/lib/design-studio/owner-cost";

export async function POST(request: Request) {
  try {
    const access = await resolveXerianoAccess();
    if (access.status !== "AUTHENTICATED") return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
    if (!hasXerianoAccountMembership(access.context)) return NextResponse.json({ error: "Eine aktive Xeriamo Mitgliedschaft ist erforderlich." }, { status: 403 });
    const authorization = authorizeXerianoGeneration(access.context);
    if (!authorization.allowed) return NextResponse.json({ error: authorization.message }, { status: authorization.status });
    const setup = designGenerationSetupSchema.parse(await request.json());
    const quote = quoteDesignCustomerGeneration(setup);
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
