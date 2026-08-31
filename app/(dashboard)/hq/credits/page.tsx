import type { Metadata } from "next";
import { Infinity as InfinityIcon, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Credits & Plan" };

export default function OwnerCreditsPage() {
  return (
    <main className="xeriano-app-page xeriano-credits-page">
      <header className="xeriano-page-header">
        <div>
          <span className="xeriano-eyebrow">OWNER · XERIAMO</span>
          <h1>Credits & Plan</h1>
          <p>Deine Owner-Generation läuft unabhängig von Kunden-Credits.</p>
        </div>
      </header>

      <section className="xeriano-owner-unlimited-card">
        <span className="xeriano-owner-unlimited-icon"><InfinityIcon aria-hidden="true" /></span>
        <div>
          <span className="xeriano-section-label">Dein aktueller Plan</span>
          <h2>Owner Unlimited</h2>
          <p>Die vollständige Xeriamo Produktsuite für deinen Owner Workspace.</p>
        </div>
        <span className="xeriano-owner-unlimited-status"><ShieldCheck aria-hidden="true" /> Unbegrenzt</span>
      </section>

      <section className="xeriano-history-placeholder">
        <Sparkles aria-hidden="true" />
        <h2>Bereit zum Erstellen</h2>
        <p>Design Studio, Creative Studio und UGC Video Studio stehen dir ohne sichtbare Credit-Verwaltung zur Verfügung.</p>
      </section>
    </main>
  );
}
