import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import "./globals.css";
import "./workspace.css";
import "./hq-navigation.css";
import "./shopify-operations.css";
import "./department-hq.css";
import "./design-studio.css";
import "./design-lab.css";
import "./design-creative-workspace.css";
import "./commerce-lab.css";
import "./facility-wings.css";
import "./mission-control.css";
import "./knowledge-vault.css";
import "./reports-center.css";
import "./brain-core.css";
import "./analytics-chamber.css";
import "./image-studio.css";

const dict = getDictionary(DEFAULT_LOCALE);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "NexHQ",
    template: "%s · NexHQ",
  },
  description: dict.common.metadata.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} dark h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
