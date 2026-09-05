import { demoSource } from "./demo";
import { jsearchSource } from "./jsearch";
import type { SourceAdapter } from "./types";

// Registry of opportunity sources. Add an adapter here and the agent picks it up automatically.
// Unconfigured adapters are listed on the admin page with their setupHint.
export const sources: SourceAdapter[] = [demoSource, jsearchSource];

export const activeSources = () => sources.filter((s) => s.configured);
