import { NextResponse } from "next/server";

import { requireXerianoAccount, XerianoAuthorizationError } from "@/lib/xeriano/server";
import {
  assertXerianoBillingOrigin,
  createXerianoPortal,
  XerianoBillingError,
} from "@/lib/xeriano/stripe-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertXerianoBillingOrigin(request);
    const context = await requireXerianoAccount();
    const result = await createXerianoPortal({ context });
    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    if (error instanceof XerianoAuthorizationError) {
      return NextResponse.json({ success: false, code: error.code, error: "Kein Zugriff." }, { status: error.status });
    }
    if (error instanceof XerianoBillingError) {
      const message = error.code === "STRIPE_CUSTOMER_NOT_FOUND"
        ? "Für diesen Account gibt es noch keine Abrechnung."
        : "Das Kundenportal ist gerade nicht verfügbar.";
      return NextResponse.json({ success: false, code: error.code, error: message }, { status: error.status });
    }
    return NextResponse.json({ success: false, code: "BILLING_UNAVAILABLE", error: "Das Kundenportal ist gerade nicht verfügbar." }, { status: 503 });
  }
}
