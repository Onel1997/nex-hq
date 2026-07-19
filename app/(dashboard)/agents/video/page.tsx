import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Home, ChevronRight } from "lucide-react";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.agents.videoStudio,
};

/**
 * Video Studio placeholder — route kept for pipeline navigation.
 * Generation is intentionally not implemented yet.
 */
export default function VideoStudioPage() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#070605] text-[#e8e2d6]">
      <header className="flex items-center justify-between gap-4 border-b border-[rgb(70_62_48_/_0.55)] px-5 py-3">
        <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[#8a8478] transition-colors hover:text-[#e8e2d6]"
          >
            <Home className="size-3.5" />
            NexHQ
          </Link>
          <ChevronRight className="size-3.5 opacity-40" />
          <span className="inline-flex items-center gap-1.5 text-[#c4a574]">
            <Clapperboard className="size-3.5" />
            {dict.agents.videoStudio}
          </span>
        </nav>
        <span className="rounded border border-[rgb(196_165_116_/_0.35)] bg-[rgb(196_165_116_/_0.14)] px-2 py-1 text-[0.68rem] uppercase tracking-wide text-[#c4a574]">
          Coming later
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Clapperboard className="size-10 text-[#c4a574] opacity-80" strokeWidth={1.25} />
        <h1 className="text-2xl font-medium tracking-tight">{dict.agents.videoStudio}</h1>
        <p className="max-w-md text-sm text-[#8a8478]">
          Platzhalter für die spätere Video-Produktion. Keine Generierung in dieser Phase.
          Brand Cast und Persona Studio bleiben die Voraussetzung.
        </p>
      </main>
    </div>
  );
}
