import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, absoluteUrl } from "@/lib/site";

// /sitemap.xml: the public pages only. Everything behind login is noindex and disallowed in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.entries(PUBLIC_PAGES).map(([path, page]) => ({ url: absoluteUrl(path), lastModified: page.lastModified }));
}
