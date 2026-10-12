import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "nodemailer"],
  outputFileTracingRoot: __dirname,
  // Resume import posts the PDF to a server action (5 MB cap, checked in importResume); the default is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  // Render <title>, description and canonical inside <head> for every visitor, crawlers included.
  // Next 15.5 otherwise streams them into <body> for most user agents; ours resolve instantly, so nothing is lost.
  htmlLimitedBots: /.*/,
  // Baseline hardening for a public site accepting logins. HSTS is left to Railway's TLS proxy.
  async headers() {
    return [
      // API responses (JSON, OAuth redirects) can't carry a robots meta tag.
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // no framing → clickjacking on the login/forms
          { key: "Strict-Transport-Security", value: "max-age=31536000" }, // always use HTTPS for this site
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // One canonical host. A Cloudflare redirect rule (which also covers http://www) is better; this is the fallback
  // so www never serves a duplicate copy of the site.
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "www\\.opportunityhunter\\.xyz" }], destination: "https://opportunityhunter.xyz/:path*", permanent: true }];
  },
};

export default nextConfig;
