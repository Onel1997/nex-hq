import type { Metadata } from "next";
import { cache } from "react";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import "./globals.css";
import "./workspace.css";
import "./hq-navigation.css";
import "./shopify-operations.css";
import "./department-hq.css";
import "./design-studio.css";
import "./design-lab.css";
import "./design-creative-workspace.css";
import "./commerce-lab.css";
import "./image-studio.css";
import "./persona-studio.css";
import "./nexhq-studio-system.css";
import "./xeriano.css";
import { getXerianoAppUrl } from "@/lib/xeriano/config";
import { XeriamoBrandingProvider } from "@/components/xeriano/branding-provider";
import { loadPublicBrandingSnapshot } from "@/lib/xeriano/branding/server";
import { resolveXeriamoBrowserBranding } from "@/lib/xeriano/branding/presentation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseMetadata: Omit<Metadata, "icons"> = {
  metadataBase: new URL(getXerianoAppUrl()),
  title: {
    default: "Xeriamo — Vom Design zum Content",
    template: "%s · Xeriamo",
  },
  description: "Erstelle Designs, professionelle Fashion-Bilder und realistische UGC-Videos in einem einfachen Workflow.",
  applicationName: "Xeriamo",
  openGraph: { type: "website", locale: "de_DE", siteName: "Xeriamo" },
  twitter: { card: "summary_large_image" },
};

const loadInitialBranding = cache(async () => {
  // Branding is live configuration rather than build-time content. This waits
  // for a real request while React cache deduplicates metadata + layout reads.
  await connection();
  return loadPublicBrandingSnapshot();
});

export async function generateMetadata(): Promise<Metadata> {
  const snapshot = await loadInitialBranding();
  const browserBranding = resolveXeriamoBrowserBranding(snapshot.branding);
  const favicon = { url: browserBranding.favicon.url, type: browserBranding.favicon.mimeType };
  return {
    ...baseMetadata,
    icons: {
      icon: [{ ...favicon, rel: "icon" }],
      shortcut: [{ ...favicon, rel: "shortcut icon" }],
      apple: [{ url: browserBranding.appleTouchIcon.url, type: browserBranding.appleTouchIcon.mimeType }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialBranding = await loadInitialBranding();
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <TooltipProvider>
          <XeriamoBrandingProvider initialSnapshot={initialBranding}>{children}</XeriamoBrandingProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
