import type { RawOpportunity, SearchQuery, SourceAdapter } from "./types";

// JSearch (RapidAPI): licensed aggregator over Google for Jobs — includes LinkedIn, Indeed, Glassdoor
// and employer-site postings. Enable with RAPIDAPI_KEY. https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch

type JSearchJob = {
  job_id: string; job_title: string; employer_name: string; job_publisher?: string;
  job_city?: string | null; job_state?: string | null; job_country?: string | null; job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string | null; job_apply_link?: string; job_google_link?: string;
  job_description?: string; job_employment_type?: string | null;
  job_min_salary?: number | null; job_max_salary?: number | null; job_salary_currency?: string | null; job_salary_period?: string | null;
  job_required_experience?: { required_experience_in_months?: number | null } | null;
  job_highlights?: { Qualifications?: string[] } | null;
};

const COUNTRY: Record<string, string> = { IN: "India", US: "United States", GB: "United Kingdom", DE: "Germany", SG: "Singapore", CA: "Canada", AU: "Australia", AE: "UAE", NL: "Netherlands", FR: "France" };
const TYPE: Record<string, string> = { FULLTIME: "full-time", PARTTIME: "part-time", CONTRACTOR: "contract", INTERN: "internship" };
const SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", SGD: "S$" };
const MAX_QUERIES_PER_RUN = 3; // ponytail: free tier is ~200 requests/month; raise when paying

function salary(j: JSearchJob) {
  if (j.job_min_salary == null && j.job_max_salary == null) return null;
  const cur = j.job_salary_currency ?? "USD";
  const nums = [j.job_min_salary, j.job_max_salary].filter((n): n is number => n != null).map((n) => Math.round(n));
  const period = j.job_salary_period === "MONTH" ? "/month" : j.job_salary_period === "HOUR" ? "/hour" : "";
  return `${SYMBOL[cur] ?? `${cur} `}${nums.join("–")}${period}`;
}

function toRaw(j: JSearchJob): RawOpportunity {
  const country = j.job_country ? COUNTRY[j.job_country] ?? j.job_country : "";
  const place = [j.job_city, j.job_state].filter(Boolean).join(", ");
  const location = j.job_is_remote ? `Remote — ${country || "Global"}` : place ? `${place}, ${country}` : country || "Not specified";
  const months = j.job_required_experience?.required_experience_in_months;
  const url = j.job_apply_link || j.job_google_link || "";
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
    employment_type: j.job_employment_type ? TYPE[j.job_employment_type] ?? "full-time" : null,
    remote_type: j.job_is_remote ? "remote" : undefined,
    country: country || undefined,
    min_years: months != null ? Math.round(months / 12) : undefined,
    nice_to_have: j.job_highlights?.Qualifications?.slice(0, 5),
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
      const params = new URLSearchParams({ query: [q.q, q.location].filter(Boolean).join(" in "), page: "1", num_pages: "1", date_posted: "week" });
      if (q.remote) params.set("remote_jobs_only", "true");
      const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
        headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY!, "x-rapidapi-host": "jsearch.p.rapidapi.com" },
      });
      if (!res.ok) throw new Error(`JSearch ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const { data } = (await res.json()) as { data?: JSearchJob[] };
      for (const j of data ?? []) if (j.job_title && j.employer_name && (j.job_apply_link || j.job_google_link)) out.push(toRaw(j));
    }
    return out;
  },
};
