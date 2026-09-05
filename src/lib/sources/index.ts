import { demoSource } from "./demo";
import type { SourceAdapter } from "./types";

// Registry of opportunity sources. Add a real adapter here (e.g. a licensed jobs API) and it will be
// picked up by the agent automatically. Unconfigured adapters are listed on the admin page with their setupHint.
export const sources: SourceAdapter[] = [
  demoSource,
  // Example integration point for a live feed (kept unconfigured until credentials exist):
  {
    name: "Jobs API (not configured)",
    category: "job",
    configured: Boolean(process.env.JOBS_API_URL && process.env.JOBS_API_KEY),
    setupHint: "Set JOBS_API_URL and JOBS_API_KEY for a licensed job-listings API, then implement fetch() in src/lib/sources/index.ts.",
    async fetch() {
      // ponytail: map the provider's response into RawOpportunity[] here; until then this source stays disabled
      return [];
    },
  },
];

export const activeSources = () => sources.filter((s) => s.configured);
