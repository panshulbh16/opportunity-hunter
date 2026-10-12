import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /robots.txt. Every crawler, Googlebot included, may fetch the public pages (listed in src/lib/site.ts).
// The signed-in app, the API (incl. /api/auth), onboarding and the auth pages are disallowed; they also send
// noindex (X-Robots-Tag for /api). Cloudflare's managed robots.txt, if enabled, is merged in front of this.
const PRIVATE = [
  "/api/", "/admin", "/dashboard", "/opportunities", "/applications", "/alerts", "/profile", "/settings", "/tailor",
  "/onboarding", "/login", "/signup", "/forgot-password", "/reset-password",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
