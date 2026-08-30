# NexHQ UX Design System

**Stand:** 17. August 2026
**Geltungsbereich:** Owner-facing NexHQ shell, Persona Studio, Design Studio, Produktbibliothek und Image Studio

## 1. Leitidee

NexHQ verwendet eine gemeinsame dunkle, ruhige Oberfläche mit leuchtendem Blau als primärer Handlungsfarbe und hellem Blau/Cyan für Auswahl, Orientierung und sekundäre Akzente. Glow bleibt auf aktive oder primäre Elemente begrenzt. Erfolg, Warnung und Gefahr behalten eigenständige semantische Farben.

Die normale Ansicht beantwortet zuerst: **Wo bin ich? Was ist der aktuelle Stand? Was muss ich als Nächstes tun?** IDs, Checksummen, Fingerprints, rohe Providerdaten und Provenance-Details gehören unter **Technische Details**.

## 2. Zentrale Tokens

Die Tokens liegen in `app/nexhq-studio-system.css`.

- `--nx-bg`, `--nx-bg-deep`: Seitenhintergrund
- `--nx-surface`, `--nx-surface-elevated`, `--nx-card`: Flächen
- `--nx-border`, `--nx-border-strong`: Grenzen
- `--nx-blue`, `--nx-blue-bright`: primäre Aktionen und aktive Zustände
- `--nx-blue-soft`, `--nx-cyan`: ausgewählte Inhalte und sekundäre Akzente
- `--nx-success`, `--nx-warning`, `--nx-danger`: semantische Zustände
- `--nx-text`, `--nx-text-muted`, `--nx-text-subtle`: Texthierarchie
- `--nx-radius-*`, `--nx-shadow-*`: Radius und Schatten

### Typografie (verbindlich)

Alle operativen NexHQ-Oberflächen verwenden **Geist Sans** über `--font-geist-sans` beziehungsweise `--nx-font-ui`. Die frühere Display-/Serif-Schrift wurde aus dem Root Layout entfernt; `font-display` ist nur noch ein Sans-Alias für ältere Komponenten. Persona, Design, Produkt und Image unterscheiden Hierarchie ausschließlich über Größe, Gewicht, Zeilenhöhe und Laufweite.

- Seitentitel: `--nx-type-page`, responsiv begrenzt auf 30–36 px
- Abschnittstitel: `--nx-type-section`, 18–22 px
- Kartentitel: `--nx-type-card`, 16 px
- Fließtext: `--nx-type-body`, 15 px
- Meta-/Hilfstext: `--nx-type-small`, 12–13 px

Große redaktionelle Serif-Überschriften sind in operativen Studio-Flows nicht zulässig. Monospace ist ausschließlich für ausdrücklich geöffnete technische Werte vorgesehen.

## 3. Komponenten

- **StudioHeader:** Studio, Zweck und Hauptaktion.
- **StudioStepper:** abgeschlossen, aktuell und noch offen; niemals Ersatz für Domain-Prüfungen.
- **Cards:** einheitliche Oberfläche, Auswahl über blauen Rand und dezenten Glow.
- **Buttons:** mindestens 42 px hoch; primär blau; deaktiviert mit sichtbarer Ursache im Kontext.
- **Status:** deutscher Owner-Text statt rohem Enum.
- **Loading:** dauerhaft sichtbar, beschreibend und mit `aria-live`.
- **Error:** bleibt sichtbar, ist handlungsorientiert; Rohdiagnose nur unter Technische Details.
- **Empty State:** erklärt Ursache und nächste Handlung.
- **TechnicalDetails:** standardmäßig geschlossen.

## 4. Deutsche Terminologie

Zentrale Status- und Authority-Begriffe liegen in `lib/ux/owner-terminology.ts`.

- Brand Model → **Markenmodel**
- SHOPIFY_LIVE → **Shopify verifiziert**
- MANUAL_PROFILE → **Manuelles Produkt**
- DETERMINISTIC_COMPOSITE → **Deterministisches Mockup**
- DRAFT_GENERATIVE_ARTWORK → **Generative Vorschau — Artwork kann verändert werden**
- REVIEW_REQUIRED → **Prüfung erforderlich**
- Prepare / Estimate → **Vorbereiten & Kosten prüfen**
- Previous runs → **Vorherige Durchläufe**

„Artwork“, „Image Studio“, „Design Studio“, „Persona Studio“, „Brand Cast“ und technische Versionsnamen dürfen als bewusst verwendete Produkt-/Fachbegriffe bestehen bleiben. „Identity Lock“ wird im normalen UI als **Identitätsfestschreibung** erklärt. Normaler Erklärungstext bleibt Deutsch.

## 5. Workflow-Regeln

### Persona

Entdeckung → Auswahl → Referenzpaket → Identitätsprüfung → Referenzrechte → Image-Freigabe → Brand Cast.

### Design

Artwork hochladen → prüfen → freigeben → in der Artwork-Bibliothek speichern. Produktwahl ist keine Voraussetzung.

### Image V2

Artwork → Produkt → Variante → Markenmodel → Aufnahme → Druckseite → Platzierung → Prüfen → Generieren → Ergebnis.

Der deterministische Produktionsmodus ist primär. V1 bleibt als generativer Entwurf sichtbar gekennzeichnet. Eine Bestätigung erzeugt genau ein Asset.

## 6. Responsive und Scroll

Owner-Workflows verwenden vollständiges Seitenscrolling. Studio-Container dürfen die Seite nicht auf eine feste Viewporthöhe begrenzen. Auf schmaleren Laptop-/Tabletbreiten werden Auswahlkarten und Inspektorbereiche einspaltig; wichtige CTAs bleiben im normalen Dokumentfluss. Innere Scrollflächen werden nur für echte Navigation vermieden, nicht als Ersatz für Seitenscrolling eingesetzt.

## 7. Accessibility

- sichtbarer Cyan-Fokusring
- semantische Buttons, Tabs, Fieldsets und Details
- beschriftete Eingaben
- mindestens 42 px hohe Hauptaktionen
- `aria-live` für Lade-/Statusmeldungen
- verständliche Alternativtexte
- keine Farbe als einziger Statusindikator

## 8. Finaler Cleanup-Stand

- Image Studio besitzt eine stabile Studio-Identität; Research-/Mission-Titel sind nur noch eingeklappter Projektkontext.
- Deterministisches V2 ist visuell primär. Generatives V1, ältere Queue und Inspector bleiben wiederherstellbar, sind aber standardmäßig eingeklappt.
- Design Studio verwendet weder Mission-Titel noch Research-Bericht als Breadcrumb oder Artwork-Name.
- Tiefe Persona-Rechte-, Identitäts- und Referenzdialoge haben deutsche Owner-Mikrotexte; rohe technische Historie bleibt unter „Technische Details“.
- Alte grün/goldene Interaktionsakzente der Studio-CSS wurden in die gemeinsame Blau/Cyan-Familie überführt; Grün, Amber und Rot bleiben semantischen Zuständen vorbehalten.

Noch offen bleiben freie, vom Provider oder aus historischen Datensätzen gelieferte Textwerte. Sie werden nicht automatisch übersetzt, damit gespeicherte Provenance nicht verfälscht wird.

## Product Intelligence controls — 2026-08-17

Product source is always owner-visible as **Shopify verifiziert** or **Manuelles Produkt**. Unknown material/availability is stated rather than scored or inferred. Product forms are progressive disclosure sections (Übersicht, Varianten, Material & Stoff, Produktbilder, Druckflächen, Technische Details), reuse the shared German typography/tokens, and keep raw IDs under technical details. Readiness is a factual checklist, not an arbitrary percentage.

## Video Studio workflow — 2026-08-18

Video Studio uses the same Geist Sans, dark blue/cyan tokens, cards, stepper, notices, loading and Technical Details patterns. Normal German sequence: Artwork → Produkt → Variante → Markenmodel → Ausgangsbild → Video-Typ → Bewegung → Kamera → Format → Prüfen → Generieren → Ergebnis. Raw provider/fingerprint/job IDs remain collapsed. Image-only Models show an explicit German Video-release blocker.

Persona adds a distinct owner milestone: **Video-Identität prüfen → Video-Identität bestätigen → Für Video Studio freigeben**. Master and five canonical references are visual, the checklist is concise, and lock/fingerprint IDs remain under **Technische Details**. The Video Studio blocker links back to this review; it never offers an automatic approval shortcut.

## Content planning states (2026-08-19)

Content Pack cards use the shared NexHQ German/blue system and show purpose, aspect intent, compatibility, and factual status. Disabled incompatibility always includes an explanation. The surface explicitly states that no automatic Stapelgenerierung occurs. Technical lineage remains outside the normal card hierarchy.

### Semantic print placement (2026-08-19)

Normal Image Studio UI asks first for **Druckseite** and then for a garment-specific **Platzierung**. Selected shot, side and placement cards use the common cyan outline, check icon and **Ausgewählt** text so state is not conveyed by color alone. Missing production prerequisites use persistent blue information notices; red is reserved for failed requests or invalid authoritative state.

Normalized TL/TR/BR/BL coordinates never lead the workflow. The visual four-point editor and numeric coordinates live under **Erweiterte Platzierung · Feinjustierung**. `Beidseitig` always includes the explanation that front and back are two separately created images.

## Reusable Druckfläche and Beidseitig (2026-08-19)

The normal placement surface shows semantic selection plus **✓ Druckfläche bereit · Version X**. Four-point geometry is hidden unless the surface is missing (**Druckfläche einrichten**) or the owner explicitly opens **Feinjustierung**. Setup copy states that calibration belongs to the physical Product and can be reused independently of Artwork. Family reuse checkboxes require explicit physical-equivalence and normalized-variant confirmation; they are never pre-authority inference.

`Beidseitig` uses two accessible plan cards with text status, side-specific shot, placement and surface readiness. **Vorderseite vorbereiten** / **Rückseite vorbereiten** changes the active single-shot form only; it is not an execution CTA. The UI always states that each image is created separately. Raw coordinates remain outside the normal summary.


## Image production simplification (2026-08-19)

Image Studio uses four owner phases: **Auswahl → Platzierung → Erstellen → Ergebnis**. **Social Content Assets** is the visually primary content-purpose choice; **Shopify Mockups** is the secondary clean product path. These controls filter the existing shot catalog and never become execution authority. Selected shots and print sides keep cyan outline, icon and `Ausgewählt`.

The normal review asks for one concise visual acknowledgement and then offers **Freigeben** / **Ablehnen**. Six durable review dimensions remain internal evidence, not six owner checkboxes. Synthetic test results and execution live under collapsed technical disclosure. Cross-variant/Product-family calibration attestations live under **Erweiterte Produktzuordnung**; exact selected-variant calibration is the frictionless safe default. Every production summary states **Artwork-Proportionen gesperrt**.

## Social Content creative controls (2026-08-20)

Normal Image Studio UI shows one compact **Kreative Richtung** card after shot selection. Preset cards use the shared blue/cyan selected state plus icon and `Ausgewählt`. Social Content exposes broad compatible choices; Shopify Mockups explain the intentionally consistent Shopify Standard philosophy. Detailed scene, location, light, camera, angle, composition, mood and optional owner note live under **Richtung anpassen**.

**Social Vielfalt planen** is collapsed progressive disclosure. It states `0 automatische Aufträge`, shows a removable local list and offers anti-repetition suggestions without pretending to be analytics. Guidance uses neutral blue styling. Raw contract values and provider implementation remain outside normal owner copy.

## Routine Image placement without calibration UI (2026-08-20)

Normal Image Studio never leads with PrintSurface terminology, four corners, normalized coordinates, Product-family attestations, or a **Druckfläche einrichten** interruption. After semantic side/placement selection, supported Products show **✓ Platzierung automatisch bereit** and **Artwork-Proportionen gesperrt**. Advanced Product-specific geometry belongs under Product Library **Technische Produktdaten · Druckflächen kalibrieren**; actual unsupported Products get a neutral actionable blocker.

Output-Ziel/Content Pack is the single visible shot-selection section; there is no duplicate numbered Aufnahme phase. The creative-direction card reserves a stable complete state by resolving defaults synchronously, so guidance does not flash or shift the page. Selection remains accessible through icon/text (`Ausgewählt`) in addition to blue/cyan styling.

## Complex internals, simple owner flow (2026-08-20)

Image Studio's daily surface uses four phases only: **Auswahl → Stil & Platzierung → Erstellen → Ergebnis**. Owner cards ask one decision at a time. Output-Ziel uses two dominant cards; Content Packs show concise content value; creative direction is preset-first with optional **Stil anpassen**; placement uses apparel language only. Current and cost summaries are mutually exclusive rather than duplicated.

Normal UI does not display PrintSurface, geometry, fingerprints, Product Profile versions, provider stages, compositor identity, synthetic tools, lineage, or internal job vocabulary. These live under one consistent **Technische Details** disclosure. Previous runs remain collapsed. Guidance is neutral blue; red is reserved for actual failures. Review uses a large preview plus **Passt das Ergebnis?**, **Freigeben**, and **Ablehnen**, without visible checklist fatigue.

Laptop layout uses three compact authority cards at wide laptop widths, two below 1200px, and one below 900px, with document scrolling and no nested workflow scroll container.

## Final Image QA interaction rules (2026-08-20)

The Artwork authority card contains a compact **Artwork wechseln** library popover with `contain` thumbnails, German names, approval state, keyboard focus, and text/icon selection state. It never displays IDs, hashes, or storage paths. A one-Model default is allowed once only; async refresh cannot seize an owner selection. Optional pack progress has no normal error banner.

Standard placement preview uses a rectangular region element rather than a quadrilateral. Provider execution uses persistent **Bild wird vorbereitet …** and **Basisbild wird erstellt …** states; actual provider/configuration failures are red and persistent, while normal guidance remains neutral.

## Product Family owner language (2026-08-20)

Normal Product Library uses **Produktfamilien**, **Farben**, **Produktbilder**, and **Druckfläche**. Green calibration shows an image plus one draggable/resizable rectangle—never raw coordinates or four points. Normal Image Studio uses compact **Produktfamilie** and **Farbe** selectors, a blank Product thumbnail, a visible allowed area, and ratio-locked Artwork controls: drag, uniformly scale, reset, and auto-fit.

Shopify IDs, variant GIDs, Product Profile/PrintSurface versions, reference checksums, supplier evidence, and mapping internals remain technical-only. The new Product chooser does not rename or collapse Content Packs, Creative Presets, Social Content, or Shopify Mockups.

## Canonical mutation feedback for Product Families (2026-08-21)

Product Family writes use compact local status rather than global or optimistic claims. Upload, detection, calibration, Product-data, and Shopify-mapping actions show a restrained spinner while the real request is active and a check only after the canonical server response is applied. Errors stay beside the failed action; pending and incomplete setup remain neutral.

Saved calibration editors collapse automatically. Color cards use compact side-by-side Front/Back slots with thumbnails, upload state, and one replace action. Success feedback uses a short fade/slide transition; `prefers-reduced-motion` removes that motion. Product Library retains document scrolling and collapses to one-column controls on narrow viewports.
