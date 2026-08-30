# Xeriamo brand asset handoff

The application currently uses a text wordmark. No placeholder bitmap or generated logo is committed. When the OWNER supplies the approved assets, use these stable public slots:

| Use | Recommended file | Required preparation |
| --- | --- | --- |
| Header wordmark | `public/brand/xeriamo-wordmark.svg` | SVG with a tight `viewBox`; test at approximately 160 × 40 CSS px on dark surfaces. |
| Standalone mark | `public/brand/xeriamo-mark.svg` | Square SVG with transparent background. |
| Browser favicon | `app/favicon.ico` | Multi-size ICO containing 16, 32 and 48 px variants. Replace only after visual approval. |
| Next.js app icon | `app/icon.png` | 512 × 512 PNG, transparent or approved solid background. |
| Apple Touch Icon | `app/apple-icon.png` | 180 × 180 PNG with safe padding. |
| Open Graph image | `app/opengraph-image.png` | 1200 × 630 PNG using the approved wordmark and Xeriamo visual language. |
| Future PWA icons | `public/brand/xeriamo-pwa-192.png`, `public/brand/xeriamo-pwa-512.png` | 192 × 192 and 512 × 512 PNG; add only with a manifest. |

Keep the text fallback until the exact approved files exist. Do not rename the internal `xeriano_*` technical namespace when installing these assets.
