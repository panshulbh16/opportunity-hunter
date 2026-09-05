// A raw record as returned by any source. Adapters map their native format to this shape;
// the AI layer's normalizeOpportunity() turns it into a stored Opportunity.
export type RawOpportunity = {
  source_name: string;
  source_url: string;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  description: string;
  posted_date: string;
  application_url: string;
  employment_type: string | null;
  // Optional structured hints a source may already know; the normalizer infers what's missing.
  skills?: string[];
  nice_to_have?: string[];
  min_years?: number;
  seniority?: string;
  remote_type?: "remote" | "hybrid" | "onsite";
  country?: string;
  company_type?: string;
  industry?: string;
  visa_sponsorship?: boolean;
};

export type SearchQuery = { q: string; location?: string; remote?: boolean };

export interface SourceAdapter {
  name: string;
  category: "job"; // future: freelance | scholarship | grant | ...
  configured: boolean;
  /** Human-readable note on what's needed to enable this source. */
  setupHint?: string;
  fetch(queries: SearchQuery[]): Promise<RawOpportunity[]>;
}
