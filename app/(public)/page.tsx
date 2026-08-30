import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Library, Palette, Play, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Vom Design zum Content",
  description: "Erstelle Designs, professionelle Fashion-Bilder und realistische UGC-Videos mit Xeriamo.",
  alternates: { canonical: "/" },
};

const faqs = [
  ["Wie funktionieren Credits?", "Jede Generierung hat einen klaren Credit-Preis. Du siehst ihn, bevor du startest."],
  ["Welche Modelle sind verfügbar?", "Xeriamo verbindet Nano Banana Pro für Bilder sowie Seedance 2.5 und Kling V3 Motion Control für Videos."],
  ["Kann ich eigene Referenzen verwenden?", "Ja. Lade Designs, Models, Produkte, Bilder oder Bewegungsreferenzen direkt in den passenden Studio-Workflow."],
  ["Verfallen Top-up Credits?", "Top-up Credits verfallen in V1 nicht bei der monatlichen Verlängerung."],
  ["Kann ich kündigen?", "Abonnements werden sicher über das Stripe Kundenportal verwaltet. Die Kündigung gilt zum Ende des bezahlten Zeitraums."],
];

export default function XerianoLandingPage() {
  return <main>
    <section className="xeriano-hero"><div className="xeriano-hero-copy"><span className="xeriano-eyebrow">Creative AI für Fashion Content</span><h1>Vom Design zum Content.</h1><p>Erstelle Designs, professionelle Fashion-Bilder und realistische UGC-Videos in einem einfachen Workflow.</p><div className="xeriano-hero-actions"><Link className="xeriano-primary-button" href="/register">Kostenlos starten <ArrowRight size={18}/></Link><a className="xeriano-secondary-button" href="#beispiele">Beispiele ansehen</a></div></div><div className="xeriano-hero-stage" aria-label="Xeriamo Workflow Vorschau"><div className="xeriano-stage-card stage-design"><Palette/><span>Design</span></div><div className="xeriano-stage-card stage-image"><ImageIcon/><span>Bild</span></div><div className="xeriano-stage-card stage-video"><Play/><span>Video</span></div><div className="xeriano-stage-glow" /></div></section>
    <section id="beispiele" className="xeriano-section"><header><span className="xeriano-eyebrow">Dein visueller Workspace</span><h2>Eine Oberfläche für deine besten Ideen.</h2></header><div className="xeriano-visual-feed">{["Design Asset","Fashion Editorial","Streetwear Campaign","UGC Motion","Product Detail","Social Creative"].map((name,i)=><article key={name} className={`xeriano-feed-tile tile-${i+1}`}><span>{name}</span><small>Bereit für deine Xeriamo Assets</small></article>)}</div></section>
    <section className="xeriano-section"><header><span className="xeriano-eyebrow">Ein Workflow. Drei Studios.</span><h2>Design → Bild → Video</h2><p>Wechsle ohne Download und erneuten Upload zwischen deinen kreativen Schritten.</p></header><div className="xeriano-feature-grid"><article><Palette/><h3>Design Studio</h3><p>Verwalte Artwork und Designs in einer klaren, privaten Bibliothek.</p></article><article><Sparkles/><h3>Creative Studio</h3><p>Referenzen hochladen. Prompt schreiben. Fashion-Bild erstellen.</p></article><article><Play/><h3>UGC Video Studio</h3><p>Bild, Bewegung und Prompt werden zu deinem nächsten UGC-Video.</p></article></div></section>
    <section className="xeriano-library-band"><Library/><div><span className="xeriano-eyebrow">Alles an einem Ort.</span><h2>Deine Bibliothek verbindet jeden Schritt.</h2><p>Designs, Bilder, Videos und Referenzen bleiben privat organisiert und direkt wiederverwendbar.</p></div></section>
    <section className="xeriano-section"><header><span className="xeriano-eyebrow">Modelle</span><h2>Starke KI-Modelle. Einfach bedienbar.</h2></header><div className="xeriano-model-row"><span>Nano Banana Pro <em>Bilder</em></span><span>Seedance 2.5 <em>Videos</em></span><span>Kling V3 Pro Motion Control <em>Identität + Bewegung</em></span></div></section>
    <section className="xeriano-pricing-teaser"><div><span className="xeriano-eyebrow">Pläne ab 19 €</span><h2>Wachse mit deinem Content.</h2><p>Klare Credits, flexible Top-ups und keine versteckten Providerpreise.</p></div><Link className="xeriano-primary-button" href="/pricing">Pläne ansehen <ArrowRight size={18}/></Link></section>
    <section className="xeriano-section xeriano-faq"><header><h2>Häufige Fragen</h2></header>{faqs.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    <section className="xeriano-final-cta"><h2>Starte mit Xeriamo.</h2><p>Dein nächstes Design, Bild oder Video beginnt mit einer Referenz und einer Idee.</p><Link className="xeriano-primary-button" href="/register">Kostenlos starten</Link></section>
  </main>;
}
