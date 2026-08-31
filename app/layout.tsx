import type { Metadata } from "next";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getXerianoAppUrl()),
  title: {
    default: "Xeriamo — Vom Design zum Content",
    template: "%s · Xeriamo",
  },
  description: "Erstelle Designs, professionelle Fashion-Bilder und realistische UGC-Videos in einem einfachen Workflow.",
  applicationName: "Xeriamo",
  openGraph: { type: "website", locale: "de_DE", siteName: "Xeriamo" },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: "/api/public/branding/favicon",
    apple: "/api/public/branding/apple-touch-icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <TooltipProvider>
          <XeriamoBrandingProvider>{children}</XeriamoBrandingProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
