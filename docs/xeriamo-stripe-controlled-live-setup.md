# Xeriamo Stripe: kontrollierter Live-Setup

Diese Datei ist eine technische Checkliste und **kein Rechtsrat**. Live-Billing
bleibt im Repository standardmäßig aus. Eine Pricing-Seite oder gesetzte
Stripe-IDs allein schalten keine Zahlungen frei.

## Runtime-Gates

Alle Gates müssen gleichzeitig erfüllt sein:

1. `XERIAMO_STRIPE_MODE=live`
2. `XERIAMO_LIVE_BILLING_ENABLED=true`
3. `NODE_ENV=production`
4. `NEXT_PUBLIC_APP_URL` ist eine kanonische HTTPS-Origin und stimmt exakt mit
   `XERIAMO_LIVE_APP_ORIGIN` überein.
5. `NEXT_PUBLIC_SUPABASE_URL` und `XERIAMO_LIVE_SUPABASE_PROJECT_REF` stimmen
   exakt mit dem im Servercode erlaubten Produktionsprojekt überein.
6. `STRIPE_SECRET_KEY` ist ein Live-Key; das Webhook-Secret ist gesetzt.
7. Alle acht Live-Price-Mappings sind gesetzt und werden bei Nutzung gegen
   Währung, Betrag, Steuerverhalten und Intervall geprüft.
8. Die versionierten Legal-Gates sind gesetzt und enthalten keine
   Platzhalter-/Draft-Bezeichnungen.
9. Merchant-Land/-Daten und Tax-Readiness sind ausdrücklich bestätigt;
   `STRIPE_AUTOMATIC_TAX_ENABLED=true`.

Ein Test-/Live-Mix bei Schlüssel, Price, Checkout Session, Event oder
Supabase-Projekt wird abgelehnt.

## Stripe Customer Portal

Vor Freigabe im Stripe Dashboard eine separate, explizite Portal Configuration
erstellen und deren `bpc_…`-ID serverseitig setzen. Für den ersten Rollout:

- Kündigung zum Periodenende erlauben.
- Subscription Update / Planwechsel deaktivieren.
- Sofortige Upgrades, Downgrades und Proration deaktivieren.
- Zahlungsmethoden-/Rechnungsansicht nur nach fachlicher Prüfung aktivieren.
- `XERIAMO_STRIPE_PORTAL_CANCELLATION_ONLY=true` erst setzen, nachdem die
  Configuration exakt so geprüft wurde.

`invoice.paid` mit `billing_reason=subscription_update` erzeugt keine Credits.
Freie Planwechsel bleiben gesperrt, bis deren Entitlement- und Creditsemantik
separat implementiert und getestet wurde.

## Webhook-Ziel

- Eigener Live-Webhook mit eigenem Live-Secret.
- API-Version: `2026-08-26.dahlia`.
- Nur die im Billing-Prozessor aufgeführten Ereignisse abonnieren.
- Raw Body und Signatur werden serverseitig geprüft.
- Event-Autorität wird privat und modegebunden für idempotentes Replay
  gespeichert.
- Success-URLs erteilen niemals Credits.

## Externe Launch-Abnahmen

Vor Aktivierung müssen außerhalb des Codes bestätigt sein:

- Stripe Live Products/Prices und inklusives EUR-Steuerverhalten;
- Automatic Tax und Steuerregistrierungen beziehungsweise eine juristisch und
  steuerlich geprüfte Alternative;
- Merchant-Land, Rechnungsdaten und Unternehmensangaben;
- rechtlich geprüfte AGB, Datenschutzerklärung, Refund-/Widerrufsregel und
  Impressum;
- Live-Webhook-Delivery, Portal-Configuration und kontrollierter End-to-End-Test;
- angewandte und geprüfte lokale Migration in der vorgesehenen Zielumgebung.

Erst danach darf ein Operator den Live-Schalter in der Produktionsumgebung
bewusst aktivieren.
