import { jsearchSource } from "./jsearch";
import type { SourceAdapter } from "./types";

// Registry of opportunity sources. Add an adapter here and the agent picks it up automatically.
// Unconfigured adapters are listed on the admin page with their setupHint.
// The demo source (./demo.ts) is kept as the matching engine's test fixture only.
export const sources: SourceAdapter[] = [jsearchSource];

export const activeSources = () => sources.filter((s) => s.configured);
