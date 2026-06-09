import { getFacilitySnapshot } from "@/lib/facility/aggregate";
import { getFacilityEventsSince } from "@/lib/facility/events";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 4_000;

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return new Response("Supabase not configured", { status: 503 });
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
          const snapshot = await getFacilitySnapshot();
          push("snapshot", snapshot);

          const newEvents = await getFacilityEventsSince(lastEventTimestamp);
          for (const event of [...newEvents].reverse()) {
            push("facility-event", event);
            if (event.timestamp > lastEventTimestamp) {
              lastEventTimestamp = event.timestamp;
            }
          }
        } catch (error) {
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
