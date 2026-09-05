import type { RawOpportunity, SearchQuery, SourceAdapter } from "./types";

// JSearch (RapidAPI): licensed aggregator over Google for Jobs — includes LinkedIn, Indeed, Glassdoor
// and employer-site postings. Enable with RAPIDAPI_KEY. https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
// Endpoint verified against the live API 2026-09-05: GET /search-v2 → { data: { jobs: [...], cursor } }

type JSearchJob = {
  job_id: string; job_title: string; employer_name: string; job_publisher?: string;
  job_city?: string | null; job_state?: string | null; job_country?: string | null; job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string | null; job_apply_link?: string; job_google_link?: string;
  job_description?: string; job_employment_types?: string[] | null;
  job_min_salary?: number | null; job_max_salary?: number | null; job_salary_period?: string | null; job_salary_string?: string | null;
  job_highlights?: { Qualifications?: string[] } | string[] | null;
};

const COUNTRY: Record<string, string> = { IN: "India", US: "United States", GB: "United Kingdom", DE: "Germany", SG: "Singapore", CA: "Canada", AU: "Australia", AE: "UAE", NL: "Netherlands", FR: "France" };
const COUNTRY_CODE = Object.fromEntries(Object.entries(COUNTRY).map(([k, v]) => [v.toLowerCase(), k.toLowerCase()]));
const TYPE: Record<string, string> = { FULLTIME: "full-time", PARTTIME: "part-time", CONTRACTOR: "contract", INTERN: "internship" };
const MAX_QUERIES_PER_RUN = 3; // ponytail: free tier is ~200 requests/month; raise when paying

function salary(j: JSearchJob) {
  if (j.job_salary_string) return j.job_salary_string;
  if (j.job_min_salary == null && j.job_max_salary == null) return null;
  const sym = j.job_country === "IN" ? "₹" : j.job_country === "GB" ? "£" : j.job_country === "DE" ? "€" : "$"; // API omits currency
  const nums = [j.job_min_salary, j.job_max_salary].filter((n): n is number => n != null).map((n) => Math.round(n));
  const period = j.job_salary_period === "MONTH" ? "/month" : j.job_salary_period === "HOUR" ? "/hour" : "";
  return `${sym}${nums.join("–")}${period}`;
}

function toRaw(j: JSearchJob): RawOpportunity {
  const country = j.job_country ? COUNTRY[j.job_country] ?? j.job_country : "";
  const place = [j.job_city, j.job_state].filter(Boolean).join(", ");
  const location = j.job_is_remote ? `Remote — ${country || "Global"}` : place ? `${place}, ${country}` : country || "Not specified";
  const url = j.job_apply_link || j.job_google_link || "";
  const quals = Array.isArray(j.job_highlights) ? undefined : j.job_highlights?.Qualifications?.slice(0, 5);
  return {
    source_name: j.job_publisher ? `${j.job_publisher} via JSearch` : "JSearch",
    source_url: url,
    title: j.job_title,
    company: j.employer_name,
    location,
    salary: salary(j),
    description: (j.job_description ?? "").slice(0, 4000),
    posted_date: (j.job_posted_at_datetime_utc ?? new Date().toISOString()).slice(0, 10),
    application_url: url,
    employment_type: TYPE[j.job_employment_types?.[0] ?? ""] ?? "full-time",
    remote_type: j.job_is_remote ? "remote" : undefined,
    country: country || undefined,
    nice_to_have: quals,
  };
}

export const jsearchSource: SourceAdapter = {
  name: "JSearch (LinkedIn, Indeed, Glassdoor…)",
  category: "job",
  configured: Boolean(process.env.RAPIDAPI_KEY),
  setupHint: "Set RAPIDAPI_KEY from a JSearch subscription on RapidAPI to pull live listings, including LinkedIn postings.",
  async fetch(queries: SearchQuery[]) {
    const out: RawOpportunity[] = [];
    for (const q of queries.slice(0, MAX_QUERIES_PER_RUN)) {
      const params = new URLSearchParams({ query: [q.q, q.location].filter(Boolean).join(" in "), num_pages: "1", date_posted: "month" });
      const cc = q.location && COUNTRY_CODE[q.location.split(",").pop()!.trim().toLowerCase()];
      if (cc) params.set("country", cc);
      if (q.remote) params.set("remote_jobs_only", "true");
      const res = await fetch(`https://jsearch.p.rapidapi.com/search-v2?${params}`, {
        headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY!, "x-rapidapi-host": "jsearch.p.rapidapi.com" },
      });
      if (!res.ok) throw new Error(`JSearch ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { data?: { jobs?: JSearchJob[] } | JSearchJob[] };
      const jobs = Array.isArray(body.data) ? body.data : body.data?.jobs ?? [];
      for (const j of jobs) if (j.job_title && j.employer_name && (j.job_apply_link || j.job_google_link)) out.push(toRaw(j));
    }
    return out;
  },
};
