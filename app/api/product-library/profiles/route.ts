import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { createManualProductProfile, listProductProfiles, toImageStudioProductFamilyProductionView, toOwnerProductProfileView } from "@/lib/product-library/service";
import { logImageStudioTimings, timeImageStudioPhase, type ImageStudioTiming } from "@/lib/image/performance-diagnostics";

export async function GET(request: Request) {
  const timings: ImageStudioTiming[] = [];
  const gated = await timeImageStudioPhase("owner-auth", requirePersonaScope, timings);
  if (!gated.ok) return gated.response;
  try {
    const profiles = await timeImageStudioPhase(
      "product-profiles",
      () => listProductProfiles(gated.scope),
      timings,
    );
    if (new URL(request.url).searchParams.get("view") === "image-production") {
      logImageStudioTimings("product-family-production-view", timings);
      return jsonOk({
        success: true,
        view: "image-production-v1",
        profiles: profiles.map(toImageStudioProductFamilyProductionView),
      });
    }
    const views = await timeImageStudioPhase(
      "signed-reference-previews",
      () => Promise.all(profiles.map((profile) => toOwnerProductProfileView(gated.scope, profile))),
      timings,
    );
    logImageStudioTimings("product-library-owner-view", timings);
    return jsonOk({ success: true, profiles: views });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const profile = await createManualProductProfile(gated.scope, await request.json());
    return jsonOk({ success: true, profile: await toOwnerProductProfileView(gated.scope, profile) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
