# Creative Studio

## Zweck

Das Creative Studio ist ein eigenständiger, promptgesteuerter Arbeitsbereich für flexible Multi-Reference-Bildideen. Es läuft unter `/creative-studio` und verwendet weder den deterministischen Runtime-Service noch Job-Snapshots des bestehenden Image Studios.

## Nutzerfluss

1. Bis zu 14 beliebige Referenzbilder hinzufügen; das wirksame Limit wird passend zum gewählten Modell angezeigt.
2. Optionale, nicht bindende Rollen vergeben.
3. Freien Prompt schreiben.
4. Modell, Seitenverhältnis, Qualität, Anzahl und Bildtyp wählen.
5. Mit Nano Banana Pro live generieren oder ein noch nicht verbundenes Modell ohne Provider-Aufruf ehrlich im Verlauf sichern.
6. Bewährte Setups in der Prompt-Bibliothek speichern, favorisieren, duplizieren, bearbeiten und wieder laden.

## Mobile-First UX

- Die Reihenfolge bleibt bewusst: Referenzen, Prompt, Schnelleinstellungen, Modell, optional „Erweitert“, Ergebnisse.
- Referenzen und Bildtypen laufen auf kleinen Displays in ruhigen horizontalen Leisten statt in gequetschten Grids.
- Seitenverhältnis, Qualität und Anzahl öffnen große, touchfreundliche Auswahlflächen. Nicht unterstützte Qualitätsstufen bleiben sichtbar, aber ehrlich deaktiviert.
- Die mobile Modellwahl öffnet als Bottom Sheet, bietet Suche, Charakterbeschreibung, Status, Referenzlimit und unterstützte Qualität.
- Die Generierungsleiste bleibt mit Safe-Area-Abstand am unteren Rand erreichbar. Alle zentralen Touch-Ziele sind mindestens ungefähr 44 Pixel hoch.
- Die Breakpoints decken 375–430 px, Tablet und große Desktop-Ansichten ab; die Gesamtseite erzeugt dabei keinen horizontalen Layout-Überlauf.

## Autoritäten

- Der Prompt steuert die kreative Kombination der Referenzen.
- Referenzrollen sind ausschließlich Hilfen und nie eine harte Produktionssperre.
- Die Modell-Registry beschreibt Fähigkeiten und den ehrlichen Verbindungsstatus.
- Pro Lauf ist genau ein Modell aktiv. Seitenverhältnis, Qualität und Anzahl sind jederzeit sichtbar und werden im Setup eingefroren.
- Nicht verbundene Modelle führen niemals implizit einen bestehenden Image-Studio-Provider aus.

## Persistenz V1

Prompt-Bibliothek und Verlauf werden browserbezogen unter `nexhq-creative-studio-v1` gespeichert. Referenzmetadaten werden im Verlauf erhalten; lokale Bilddateien und Blob-URLs werden bewusst nicht dauerhaft in `localStorage` geschrieben.

Suche und Filter laufen lokal über validierte Metadaten. Es werden keine Bilddateien, Base64-Payloads oder temporären Vorschau-URLs in `localStorage` geschrieben.

Live-Ergebnisse und Job-Manifeste werden separat und privat im NexHQ-Supabase-Bucket `creative-studio-assets` abgelegt. Der Bucket wird bei der ersten autorisierten Live-Ausführung privat und ohne Datenbankmigration angelegt, sofern die vorhandene Supabase-Servicekonfiguration dies erlaubt. Der Browser erhält ausschließlich authentifizierte Creative-Studio-Asset-URLs, keine privaten Storage-Pfade.

## Provider-Seam

`CreativeImageProvider` ist die providerneutrale Ausführungsgrenze. Die Registry enthält GPT Image, Higgsfield Soul, Higgsfield Soul Cinema, Seedream, Recraft und Nano Banana Pro. Ausschließlich Nano Banana Pro ist live verbunden; alle anderen Einträge bleiben wahrheitsgemäß nicht verbunden.

### Nano Banana Pro via fal

- Text ohne Referenz: `fal-ai/nano-banana-pro`
- Multi-Reference: `fal-ai/nano-banana-pro/edit`
- Referenzen: maximal 14, in Besitzer-Reihenfolge
- Seitenverhältnisse: Auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3 und 9:16
- Qualität: 1K, 2K oder 4K
- Anzahl: 1–4 über den nativen `num_images`-Parameter
- Ausgabe: PNG; Websuche deaktiviert; Queue-Ausführung mit persistierter Provider-Request-ID
- Eingang zum Provider: freier Prompt plus optionale Bildtyp-/Rollenhinweise; die ursprüngliche Anweisung bleibt separat und im tatsächlich gesendeten Prompt sichtbar

Die Browser-Request-ID ist die Job- und Idempotenzautorität. Vor dem fal-Aufruf wird ein unveränderlicher Claim geschrieben. Ein doppelter Request lädt den vorhandenen Status und startet niemals blind eine zweite kostenpflichtige Ausführung. Ein unklarer Queue-/Netzwerkausgang wird als `UNKNOWN_OUTCOME` eingefroren.

### Kosten- und Umgebungsgrenzen

Die aktuelle veröffentlichte fal-Preisgrundlage wird versioniert im Code geführt: 1K/2K maximal 0,15 USD pro erfolgreichem Bild, 4K maximal 0,30 USD pro erfolgreichem Bild. Vor Ausführung muss das berechnete Batch-Maximum innerhalb von `NEXHQ_CREATIVE_NANO_BANANA_COST_MAX_USD` liegen. Websuche bleibt aus und erzeugt daher keinen Suchzuschlag.

Erforderlich:

- `FAL_KEY`
- `NEXHQ_CREATIVE_NANO_BANANA_COST_MAX_USD`
- vorhandene private Supabase-Konfiguration (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- vorhandene Workspace-/Auth-Konfiguration

Secrets bleiben ausschließlich auf dem Server. `.env.local` wird durch die Implementierung nicht verändert.

## Trennung zum Image Studio

- eigene Route
- eigene Komponenten
- eigener Domainordner
- eigene Persistenz
- kein Import des deterministischen Image-Studio-Runtime-Service
- keine Änderung an Image-Studio-Jobs, Artwork-Autorität oder Providerpfaden
