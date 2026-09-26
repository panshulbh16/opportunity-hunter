import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { Analytics } from "@/components/Analytics";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Opportunity Hunter", template: "%s · Opportunity Hunter" },
  description: "Tell us what you want. We'll keep hunting for it. AI-powered job matching that never stops searching.",
  applicationName: "Opportunity Hunter",
  appleWebApp: { capable: true, title: "Opportunity Hunter", statusBarStyle: "default" },
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
