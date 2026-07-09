import { NextResponse } from "next/server";
import { getFacilitySnapshotResult } from "@/lib/facility/aggregate";
import { buildFallbackFacilitySnapshot } from "@/lib/facility/fallback-snapshot";
import { FACILITY_QUOTA_DEGRADED_HEADER } from "@/lib/facility/facility-api";
import { isProviderQuotaError, isRecoverableFacilityError } from "@/lib/facility/provider-errors";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

function facilityJsonResponse(
  snapshot: ReturnType<typeof buildFallbackFacilitySnapshot>,
  quotaDegraded: boolean,
) {
  const response = NextResponse.json(snapshot);
  if (quotaDegraded) {
    response.headers.set(FACILITY_QUOTA_DEGRADED_HEADER, "true");
  }
  return response;
}

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      console.warn("[Facility] Supabase not configured — serving local fallback snapshot");
      return facilityJsonResponse(buildFallbackFacilitySnapshot(), false);
    }

    const { snapshot, quotaDegraded } = await getFacilitySnapshotResult();
    return facilityJsonResponse(snapshot, quotaDegraded);
  } catch (error) {
    if (isRecoverableFacilityError(error)) {
      console.warn("[Facility] Recoverable error — serving local fallback snapshot:", error);
      return facilityJsonResponse(
        buildFallbackFacilitySnapshot(),
        isProviderQuotaError(error),
      );
    }

    const message =
      error instanceof Error ? error.message : dict.ceo.errors.unexpected;
    console.error("[Facility]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
