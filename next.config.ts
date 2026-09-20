import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "nodemailer"],
  outputFileTracingRoot: __dirname,
  // Resume import posts the PDF to a server action (5 MB cap, checked in importResume); the default is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  // Baseline hardening for a public site accepting logins. HSTS is left to Railway's TLS proxy.
  async headers() {
    return [
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
};

export default nextConfig;
