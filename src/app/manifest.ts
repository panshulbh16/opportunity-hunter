import type { MetadataRoute } from "next";

// Web app manifest → served at /manifest.webmanifest and auto-linked by Next. Makes the site
// installable ("Add to Home Screen") as a standalone app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Opportunity Hunter",
    short_name: "Opportunity Hunter",
    description: "An AI agent that hunts for jobs, scores each match, and tracks your applications.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
