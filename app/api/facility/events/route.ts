import { getFacilitySnapshotResult } from "@/lib/facility/aggregate";
import { buildFallbackFacilitySnapshot } from "@/lib/facility/fallback-snapshot";
import { getFacilityEventsSince } from "@/lib/facility/events";
import { isProviderQuotaError, isRecoverableFacilityError } from "@/lib/facility/provider-errors";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 4_000;

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    const encoder = new TextEncoder();
    const fallback = buildFallbackFacilitySnapshot();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseMessage("connected", { ok: true })));
        controller.enqueue(encoder.encode(sseMessage("facility-mode", { quotaDegraded: false })));
        controller.enqueue(encoder.encode(sseMessage("snapshot", fallback)));
        request.signal.addEventListener("abort", () => controller.close());
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const encoder = new TextEncoder();
  let lastEventTimestamp = new Date(0).toISOString();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(sseMessage(event, data)));
      };

      const tick = async () => {
        try {
          const { snapshot, quotaDegraded } = await getFacilitySnapshotResult();
          push("facility-mode", { quotaDegraded });
          push("snapshot", snapshot);

          const newEvents = await getFacilityEventsSince(lastEventTimestamp);
          for (const event of [...newEvents].reverse()) {
            push("facility-event", event);
            if (event.timestamp > lastEventTimestamp) {
              lastEventTimestamp = event.timestamp;
            }
          }
        } catch (error) {
          if (isRecoverableFacilityError(error)) {
            push("facility-mode", { quotaDegraded: isProviderQuotaError(error) });
            push("snapshot", buildFallbackFacilitySnapshot());
            return;
          }
          push("error", {
            message:
              error instanceof Error ? error.message : "Stream update failed",
          });
        }
      };

      push("connected", { ok: true });
      await tick();

      const interval = setInterval(() => {
        void tick();
      }, POLL_MS);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
