import Link from "next/link";
import { XeriamoBrandLockup } from "@/components/xeriano/brand-identity";

export function XerianoPublicHeader() {
  return <header className="xeriano-public-header"><div className="xeriano-public-header-inner">
    <Link href="/" className="xeriano-wordmark" aria-label="Xeriamo Startseite"><XeriamoBrandLockup /></Link>
    <nav className="xeriano-public-nav" aria-label="Hauptnavigation"><Link href="/#beispiele">Beispiele</Link><Link href="/pricing">Pricing</Link><Link href="/login">Anmelden</Link><Link className="xeriano-nav-cta" href="/register">Kostenlos starten</Link></nav>
    <details className="xeriano-mobile-menu"><summary aria-label="Menü öffnen">☰</summary><div><Link href="/#beispiele">Beispiele</Link><Link href="/pricing">Pricing</Link><Link href="/login">Anmelden</Link><Link href="/register">Kostenlos starten</Link></div></details>
  </div></header>;
}
