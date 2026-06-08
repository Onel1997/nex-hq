"use client";

import { SUGGESTED_ACTIONS } from "@/lib/mock/command-center";
import { cn } from "@/lib/utils";
import { ArrowUp } from "lucide-react";

export function AiCommandInterface() {
  return (
    <section className="relative py-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2"
        aria-hidden
      >
        <div className="mx-auto h-[400px] max-w-4xl rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16 lg:px-20 lg:py-20">
          <p className="text-label mb-8 text-primary/80">Command Center</p>

          <h2 className="command-interface-headline mb-12 max-w-3xl">
            What would you like Milaene to do today?
          </h2>

          <div className="relative">
            <textarea
              readOnly
              placeholder="Plan a drop, research trends, review creative direction..."
              rows={4}
              className={cn(
                "w-full resize-none rounded-2xl border border-border bg-background/40",
                "px-6 py-5 text-lg text-foreground placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-2 focus:ring-primary/25",
              )}
            />
            <button
              type="button"
              disabled
              className="absolute bottom-4 right-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground opacity-50"
              aria-label="Send command"
            >
              <ArrowUp className="size-5" />
            </button>
          </div>

          <p className="mt-8 text-center text-base text-muted-foreground">
            CEO Agent ready · Your AI team awaits direction
          </p>
        </div>

        <div className="mt-12 space-y-6">
          <p className="text-center text-label">Suggested</p>
          <div className="flex flex-wrap justify-center gap-3">
            {SUGGESTED_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                className={cn(
                  "rounded-full border border-border bg-card/40 px-6 py-3",
                  "text-base text-muted-foreground transition-all duration-300",
                  "hover:border-primary/30 hover:bg-primary/5 hover:text-foreground",
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
