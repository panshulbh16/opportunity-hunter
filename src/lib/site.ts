import type { Metadata } from "next";

// What search engines see: the canonical origin, the public (indexable) pages and their last-modified
// dates, and the structured-data entities shared across pages. Signed-in, auth and onboarding routes are noindex.
// Bump a page's lastModified when its text meaningfully changes: it feeds sitemap.xml and, for the
// legal pages, the "Last updated" line shown on the page.

// Fixed rather than read from APP_URL, so a Railway or preview domain can never become the canonical one.
export const SITE_URL = "https://opportunityhunter.xyz";
export const SITE_NAME = "Opportunity Hunter";
export const AUTHOR = { name: "Panshul Bharadwaj", url: "https://panshulbh16.github.io/" };

export const PUBLIC_PAGES = {
  "/": { name: "Home", title: "Opportunity Hunter — AI Job Matching Agent", lastModified: "2026-10-12" },
  "/pricing": { name: "Pricing", title: "Pricing — Free and Pro Plans", lastModified: "2026-09-21" },
  "/terms": { name: "Terms of Service", title: "Terms of Service", lastModified: "2026-09-19" },
  "/privacy": { name: "Privacy Policy", title: "Privacy Policy", lastModified: "2026-09-26" },
  "/refunds": { name: "Cancellation & Refund Policy", title: "Cancellation & Refund Policy", lastModified: "2026-09-19" },
  "/contact": { name: "Contact", title: "Contact", lastModified: "2026-09-19" },
} as const satisfies Record<string, { name: string; title: string; lastModified: string }>;

export type PublicPath = keyof typeof PUBLIC_PAGES;
export type Subpage = Exclude<PublicPath, "/">;

export const absoluteUrl = (path: string) => (path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2026-09-26" → "26 September 2026". */
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export const OG_IMAGE = { url: "/icons/icon-512.png", width: 512, height: 512, alt: "Opportunity Hunter logo" };

/** Title, page-specific description, canonical URL, indexing and social tags for a public page. */
export function pageMetadata(path: PublicPath, description: string): Metadata {
  const { title } = PUBLIC_PAGES[path];
  const fullTitle = path === "/" ? title : `${title} · ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US", url: absoluteUrl(path), title: fullTitle, description, images: [OG_IMAGE] },
    twitter: { card: "summary", title: fullTitle, description },
  };
}

// Structured-data entities, linked by @id. Google resolves @id only within one page, so every page
// that refers to the author also carries the Person node.
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const AUTHOR_ID = `${SITE_URL}/#author`;
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export const authorLd = {
  "@type": "Person",
  "@id": AUTHOR_ID,
  name: AUTHOR.name,
  url: AUTHOR.url,
  sameAs: ["https://github.com/panshulbh16"],
};

export const websiteLd = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  inLanguage: "en",
  author: { "@id": AUTHOR_ID },
  publisher: { "@id": AUTHOR_ID },
};

export const organizationLd = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: { "@type": "ImageObject", url: `${SITE_URL}${OG_IMAGE.url}`, width: OG_IMAGE.width, height: OG_IMAGE.height },
  founder: { "@id": AUTHOR_ID },
};

/** WebPage + BreadcrumbList (Home → page) for a public subpage, matching its visible breadcrumb. */
export function subpageLd(path: Subpage, description: string) {
  const { name, title, lastModified } = PUBLIC_PAGES[path];
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: "en",
        dateModified: lastModified,
        isPartOf: { "@id": WEBSITE_ID },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        author: { "@id": AUTHOR_ID },
        publisher: { "@id": AUTHOR_ID },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: PUBLIC_PAGES["/"].name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name, item: url },
        ],
      },
      websiteLd,
      authorLd,
    ],
  };
}
