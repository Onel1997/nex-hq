import {
  getPersonaDashboardCounts,
  listImageReadyPersonas,
  listVideoReadyPersonas,
} from "@/lib/persona/services/persona-service";
import { listImageStudioIntegrationHooks } from "@/lib/persona/future/image-studio-hooks";
import { listVideoStudioIntegrationHooks } from "@/lib/persona/future/video-studio-hooks";
import { jsonError, jsonOk, requirePersonaScope } from "../_utils";

/** Future studio integration status — placeholders only. No generation. */
export async function GET() {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const [imageReady, videoReady, counts] = await Promise.all([
      listImageReadyPersonas(gated.scope),
      listVideoReadyPersonas(gated.scope),
      getPersonaDashboardCounts(gated.scope),
    ]);
    return jsonOk({
      image_ready_personas: imageReady.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        status: p.status,
        image_use_approved: p.image_use_approved,
        video_use_approved: p.video_use_approved,
      })),
      video_ready_personas: videoReady.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        status: p.status,
        image_use_approved: p.image_use_approved,
        video_use_approved: p.video_use_approved,
      })),
      counts,
      image_studio: {
        ready: false,
        hooks: listImageStudioIntegrationHooks(),
        note: "Image Studio handoff is a Phase 1.1 placeholder.",
      },
      video_studio: {
        ready: false,
        hooks: listVideoStudioIntegrationHooks(),
        note: "Video Studio handoff is a Phase 1.1 placeholder.",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
