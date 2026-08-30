# Content Packs

Status: **IMPLEMENTED V1 — planning only** (2026-08-19)

## Authority and safety

A Content Pack is a deterministic selection catalog inside Image Studio. It is not a generation queue and owns no provider authority.

`one selected shot → one Prepare/Estimate → one confirmation → one job → one asset → one human review`

No pack may auto-select every shot, auto-confirm, auto-generate the next shot, or count an unrelated historical asset.

## Basis-Pack

1. Shopify Produktbild — Shopify — 1:1 / 4:5
2. Lifestyle mit Model — Instagram Beitrag / Social / Kampagne — 4:5 or shot-dependent
3. Premium Flatlay — Shopify / Instagram Beitrag / Social — 1:1 / 4:5
4. Kleiderbügel / Kleiderstange — Shopify / Instagram Beitrag / Social — 4:5
5. Social Hero / Story — Instagram Story / Reel Cover / Social / Kampagne — 9:16

## Winning Design Expansion

Manual owner trigger only: Clean Front, Clean Back, Premium Flatlay, Styled Flatlay, Kleiderbügel, Kleiderstange, Gefaltetes Produkt, Detailaufnahme, Lifestyle Portrait, Lifestyle Ganzkörper, Campaign Hero, Feed Post, Story Vertical, Carousel Cover, Product Highlight.

## Compatibility

Known T-Shirt, Hoodie, Zip Hoodie, Jogger/Pants, Headwear and Jacket kinds receive deterministic compatible choices. Zip, hood, leg and headwear-specific shots are visible only for matching Product kinds. Unknown types retain generic Product/flatlay/detail/social-safe shots and never acquire invented construction.

## Progress

Per-shot state is `Nicht erstellt`, `In Prüfung`, `Freigegeben`, or `Abgelehnt`. A historical run counts only if the exact Artwork ID/version/checksum, Product profile/version/variant, required Brand Model, and shot identity match.

## Shot selection and side intent (2026-08-19)

A Content Pack card is the canonical single-shot selector. The selected card has a blue/cyan state, check indicator and **Ausgewählt** label; a second selection replaces the first. Stable Content Pack IDs are the exact planned `assetId` used by V2 Prepare and later lineage.

Shots may carry a recommendation only: Clean Front recommends `Vorne`, Clean Back recommends `Hinten`, and the Basis-Pack's product/lifestyle/flatlay/hanger/social starting shots recommend `Vorne`. Owner-selectable compositions do not override an explicit owner side choice. Recommendations do not authorize geometry or execution.

`Beidseitig` never fans a pack out. It plans a front shot and a back shot; each is later selected and executed separately.

## Side-aware planning and reusable surfaces — 2026-08-19

Each canonical Content Pack shot declares the sides it can truthfully show. `Clean Front` and Shopify front product views resolve to a distinct `Clean Back` shot for rear production; a combination without an explicit compatible shot fails closed. Owner-selectable Flatlay, Lifestyle, Hanger, Social, and Campaign shots keep side separate from shot identity.

`Beidseitig` is a planning projection, not a batch. It contains one front entry and one back entry, each with its own canonical shot, semantic placement, Product-owned PrintSurface and exact-lineage status. The plan reports `0/2`, `1/2`, or `2/2` created but never calls Prepare itself.

## Creative direction integration — 2026-08-20

Content Pack shot identity remains the single execution selector. A selected shot may now carry one active structured creative direction. The Basis-Pack still contains exactly five slots. Its Social-capable shots receive compatible creative presets; Shopify Product image remains intentionally consistent.

Winning Design Expansion keeps its fifteen selectable shot identities and can reuse the broader Social preset library. `Social Vielfalt` is a local planning helper for several directions of the same shot. It creates zero jobs, performs no random generation and never changes exact-lineage pack progress.

## One visible shot selection (2026-08-20)

Content Pack / Output-Ziel is now the complete visible Aufnahme selection in Image Studio; the redundant numbered Aufnahme phase was removed. This is not a second authority and does not change the contract: selecting another card replaces the active canonical shot, whose ID is frozen in V2 and used for exact-lineage progress/history. Creative direction is synchronously completed for the active shot, independent of asynchronous pack-progress loading.

Side and semantic placement remain separate choices. Supported Product-family templates can resolve their regions automatically; Content Packs neither calibrate Product geometry nor create jobs.

## Daily Content Pack presentation (2026-08-20)

The normal card surface shows only title, short purpose, useful channel labels, factual progress, compatibility, and selected state. Aspect/debug metadata is hidden. Social Content shows Basis-Pack, Winning Design Expansion, and Eigene Auswahl; Winning shots are grouped by owner purpose. Shopify Mockups suppress pack tabs and expose only the three Shopify-compatible Basis choices under **Shopify Standard**.

This is presentation only. Pack definitions, exact-lineage progress, canonical shot IDs, zero automatic jobs, and one-shot replacement semantics remain unchanged.
