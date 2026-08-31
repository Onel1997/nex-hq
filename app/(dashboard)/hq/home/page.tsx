import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Library,
  Palette,
  Settings,
  Sparkles,
  UsersRound,
} from "lucide-react";

export const metadata: Metadata = { title: "Home" };

const productLinks = [
  {
    href: "/hq/design-studio",
    eyebrow: "01",
    title: "Design verwalten",
    description: "Artwork hochladen und für neue Kreationen organisieren.",
    icon: Palette,
  },
  {
    href: "/hq/creative-studio",
    eyebrow: "02",
    title: "Bild erstellen",
    description: "Referenzen und Prompt im Creative Studio kombinieren.",
    icon: Sparkles,
  },
  {
    href: "/hq/ugc-video-studio",
    eyebrow: "03",
    title: "UGC Video erstellen",
    description: "Identität, Bewegung und gewählte Videolänge verbinden.",
    icon: Clapperboard,
  },
] as const;

export default function OwnerHomePage() {
  return (
    <main className="xeriano-app-page">
      <header className="xeriano-app-welcome">
        <div>
          <span className="xeriano-eyebrow">OWNER · XERIAMO</span>
          <h1>Was möchtest du heute erstellen?</h1>
          <p>Die vollständige Xeriamo Produktsuite in deinem Owner Workspace.</p>
        </div>
        <div className="xeriano-credit-pill" aria-label="Owner Plan">
          <span>Owner Unlimited</span>
          <small>Owner Workspace</small>
        </div>
      </header>

      <section className="xeriano-quick-create" aria-label="Xeriamo Studios">
        {productLinks.map(({ href, eyebrow, title, description, icon: Icon }) => (
          <Link href={href} key={href}>
            <Icon aria-hidden="true" />
            <span>{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
            <ArrowRight aria-hidden="true" />
          </Link>
        ))}
      </section>

      <section className="xeriano-home-library">
        <div>
          <Library aria-hidden="true" />
          <div>
            <h2>Bibliothek</h2>
            <p>Designs, Bilder, Videos und Kreationen deines Accounts.</p>
          </div>
        </div>
        <Link href="/hq/library">Bibliothek öffnen <ArrowRight aria-hidden="true" /></Link>
      </section>

      <section className="xeriano-home-library" aria-label="Verwaltung">
        <div>
          <UsersRound aria-hidden="true" />
          <div>
            <h2>Verwaltung</h2>
            <p>Kunden verwalten oder den Owner Workspace konfigurieren.</p>
          </div>
        </div>
        <div className="xeriano-owner-home-actions">
          <Link href="/hq/customers">Kunden <ArrowRight aria-hidden="true" /></Link>
          <Link href="/settings"><Settings aria-hidden="true" /> Einstellungen</Link>
        </div>
      </section>
    </main>
  );
}
