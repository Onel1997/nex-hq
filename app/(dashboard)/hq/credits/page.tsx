import type { Metadata } from "next";
import { CircleDollarSign, Infinity as InfinityIcon, ShieldCheck } from "lucide-react";

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
          <p>Creative Studio und UGC Video Studio benötigen für exakte Owner-Autorität keine Credit-Reservierung.</p>
        </div>
        <span className="xeriano-owner-unlimited-status"><ShieldCheck aria-hidden="true" /> Unbegrenzt</span>
      </section>

      <section className="xeriano-history-placeholder">
        <CircleDollarSign aria-hidden="true" />
        <h2>Interne Kosten bleiben messbar</h2>
        <p>Owner Unlimited entfernt ausschließlich die Kunden-Abbuchung. Provider-Kostenlimits und interne Laufdaten bleiben aktiv.</p>
      </section>
    </main>
  );
}
