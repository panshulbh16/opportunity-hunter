import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { Analytics } from "@/components/Analytics";
import { AUTHOR, OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Defaults for every route. Public pages add a canonical URL and their own description via pageMetadata()
// (src/lib/site.ts); the signed-in app, auth pages and onboarding opt out of indexing in their layouts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "Tell us what you want. We'll keep hunting for it. AI-powered job matching that never stops searching.",
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  ...(process.env.GOOGLE_SITE_VERIFICATION && { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }),
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", images: [OG_IMAGE] },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#18181b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">{children}<PWARegister /><Analytics id="G-E62Y9C8XXB" site="Opportunity Hunter" accent="#18181b" /></body>
    </html>
  );
}
