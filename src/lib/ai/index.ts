// Opportunity Hunter AI layer. Deterministic, explainable rule-based matching.
// ponytail: no LLM dependency; every function here is a seam where a model call can replace the heuristic
// (e.g. generateMatchExplanation → prompt an LLM with the breakdown) without touching callers.

import type { RawOpportunity, SearchQuery } from "../sources/types";
// Sync cosine reads only — client-safe, no DB. The server fills the store (embeddings.ts) before scoring.
import { bestSimilarity, similarity } from "./embeddings-store.ts";

// A required skill counts as covered above this cosine even without an exact string match
// (e.g. "React" ↔ "Next.js"); the title earns a semantic role floor above ROLE_SIM.
const SKILL_SIM = 0.72;
const ROLE_SIM = 0.5;

/** One string that stands in for the whole profile when comparing against a listing's description. */
export const profileSummaryText = (p: Profile) => [p.roles.join(", "), p.current_role, p.skills.join(", ")].filter(Boolean).join(". ");

// ---------- Types ----------

export type Profile = {
  roles: string[];
  skills: string[];
  keywords: string[];
  industries: string[];
  companies: string[];
  excluded_companies: string[];
  excluded_keywords: string[];
  years_experience: number;
  current_role: string;
  education: string;
  seniority: string;
  locations: string[];
  remote_preference: string[]; // remote | hybrid | onsite
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  salary_period: string; // year | month
  employment_types: string[]; // full-time | part-time | contract | internship
  preferences: string[]; // visa_sponsorship | relocation_support | remote_only | startup | product_company
  notification_threshold: number;
  search_frequency: string; // daily | twice_daily | weekly
};

export type NormalizedOpportunity = {
  category: "job";
  title: string;
  company: string;
  location: string;
  country: string;
  remote_type: "remote" | "hybrid" | "onsite";
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  salary_period: string;
  description: string;
  skills: string[];
  nice_to_have: string[];
  min_years: number;
  seniority: string;
  employment_type: string;
  company_type: string;
  industry: string;
  visa_sponsorship: number;
  source: string;
  source_url: string;
  application_url: string;
  posted_date: string;
  canonical_url: string;
  dedupe_key: string;
};

export type Opportunity = NormalizedOpportunity & { id: number; is_demo: number; created_at: string };

export type Breakdown = {
  score: number;
  skills_score: number;
  role_score: number;
  experience_score: number;
  location_score: number;
  salary_score: number;
  excluded: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  missingNice: string[];
  matchedRole: string | null;
  typeMismatch: boolean;
  locHit: boolean;
  globalScope: boolean;
};

export type Explanation = {
  strengths: string[];
  gaps: string[];
  difficulty: "low" | "medium" | "high";
  difficultyReason: string;
};

export type NextAction = { action: "apply" | "consider" | "skip"; label: string; reason: string };

// ---------- Vocab ----------

// A cross-profession skill vocabulary. Used both to infer a listing's skills from its description and to
// parse a free-text profile, so it must cover the fields Opportunity Hunter serves — not just software.
export const KNOWN_SKILLS = [
  // Software & data
  "Python", "Java", "Go", "Rust", "TypeScript", "JavaScript", "C++", "React", "Next.js", "Node.js", "Django", "Flask",
  "FastAPI", "SQL", "PostgreSQL", "MySQL", "Redis", "MongoDB", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform",
  "Spark", "Airflow", "Kafka", "PyTorch", "TensorFlow", "Scikit-learn", "Pandas", "NLP", "Computer Vision", "LLM", "RAG",
  "Vector Databases", "LangChain", "MLOps", "MLflow", "Prompt Engineering", "Transformers", "Machine Learning",
  "Deep Learning", "GraphQL", "REST APIs", "gRPC", "Linux", "CI/CD", "Jenkins", "System Design",
  "Distributed Systems", "CUDA", "OpenCV", "Recommender Systems", "Spring Boot", "OpenAI API", "Anthropic API",
  "Data Analysis", "Data Visualization", "Tableau", "Power BI", "Statistics",
  // Healthcare & medicine
  "Patient Care", "Nursing", "Cardiology", "Pediatrics", "Radiology", "Surgery", "Oncology", "Anesthesia",
  "Emergency Medicine", "Clinical Research", "Phlebotomy", "ACLS", "BLS", "Medication Administration", "Physiotherapy",
  "Pharmacology", "Public Health", "Mental Health", "Dentistry", "EMR", "Diagnostics", "Nutrition",
  "MBBS", "Clinical Practice", "Internal Medicine", "General Medicine",
  // Finance & accounting
  "Accounting", "Bookkeeping", "Financial Modeling", "Financial Analysis", "Auditing", "Taxation", "QuickBooks",
  "GAAP", "Budgeting", "Payroll", "Accounts Payable", "Accounts Receivable", "Investment Analysis", "Risk Management",
  "SAP", "Microsoft Excel",
  // Marketing & sales
  "SEO", "SEM", "Google Ads", "Content Marketing", "Social Media Marketing", "Copywriting", "Email Marketing",
  "Brand Management", "Market Research", "Lead Generation", "CRM", "Salesforce", "Public Relations",
  "Business Development", "Account Management", "Negotiation",
  // Design & creative
  "Figma", "Adobe Photoshop", "Adobe Illustrator", "Adobe InDesign", "UI/UX Design", "Graphic Design", "Video Editing",
  "Premiere Pro", "After Effects", "Motion Design", "Wireframing", "Prototyping",
  // Legal
  "Legal Research", "Litigation", "Contract Law", "Corporate Law", "Compliance", "Intellectual Property",
  "Legal Drafting", "Paralegal",
  // HR, operations & project delivery
  "Recruiting", "Talent Acquisition", "Employee Relations", "Onboarding", "Operations Management", "Supply Chain",
  "Logistics", "Procurement", "Inventory Management", "Project Management", "Product Management", "Agile", "Scrum",
  "Six Sigma", "Stakeholder Management", "Business Analysis",
  // Education
  "Teaching", "Curriculum Development", "Lesson Planning", "Classroom Management", "Tutoring", "E-Learning",
  // Customer & general
  "Customer Service", "Customer Support", "Technical Writing", "Translation", "Microsoft Office",
];

const SKILL_SYNONYMS: Record<string, string> = {
  ai: "machine learning", "artificial intelligence": "machine learning", ml: "machine learning", "gen ai": "llm",
  genai: "llm", "generative ai": "llm", llms: "llm", "large language models": "llm", "vector database": "vector databases",
  "vector db": "vector databases", vectordb: "vector databases", k8s: "kubernetes", postgres: "postgresql",
  js: "javascript", ts: "typescript", node: "node.js", nodejs: "node.js", reactjs: "react",
  "retrieval augmented generation": "rag", "retrieval-augmented generation": "rag", "amazon web services": "aws",
  "google cloud": "gcp", "scikit learn": "scikit-learn", sklearn: "scikit-learn", cv: "computer vision",
};

const SENIORITY_RANK: Record<string, number> = { intern: 0, junior: 1, mid: 2, senior: 3, lead: 4, manager: 5, director: 6 };

const CURRENCY_TO_INR: Record<string, number> = { INR: 1, USD: 84, EUR: 91, GBP: 106, SGD: 62, AED: 23, CAD: 61, AUD: 55 };

const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", SGD: "S$", AED: "AED ", CAD: "C$", AUD: "A$" };

// ---------- Helpers ----------

export const normSkill = (s: string) => {
  const k = s.trim().toLowerCase();
  return SKILL_SYNONYMS[k] ?? k;
};

const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ").replace(/\s+/g, " ").trim();

const ROLE_PHRASES: [RegExp, string][] = [
  [/machine[\s-]*learning/g, "ml"], [/artificial intelligence/g, "ml"], [/\bgen(erative)?[\s-]*ai\b/g, "ml"],
  [/\bai\b/g, "ml"], [/large language models?/g, "llm"],
  [/\bmedical officers?\b/g, "physician"], [/\bdoctors?\b/g, "physician"], [/\bclinicians?\b/g, "physician"],
];
const ROLE_STOP = new Set(["engineer", "developer", "programmer", "dev", "senior", "junior", "staff", "principal", "lead",
  "sr", "jr", "the", "of", "and", "for", "a", "an", "remote", "hybrid", "onsite", "i", "ii", "iii", "iv", "engineering",
  "consultant", "resident", "registrar"]);

export type RoleFamily = "management" | "engineering" | "healthcare" | "finance" | "other";

function roleTokens(s: string) {
  let t = normText(s.replace(/\(.*?\)/g, ""));
  for (const [re, rep] of ROLE_PHRASES) t = t.replace(re, rep);
  return new Set(t.split(" ").filter((w) => w && !ROLE_STOP.has(w)));
}

function roleFamily(s: string): RoleFamily {
  const t = s.toLowerCase();
  if (/\b(manager|director|head of|vp|vice president|chief)\b/.test(t) && !/\b(medical officer|nursing)\b/.test(t)) return "management";
  if (/\b(nurse|nursing|physician|doctor|surgeon|pharmacist|clinician|mbbs|dentist|physiotherap|anesthet|anaesthet|medical officer)\b/.test(t)) return "healthcare";
  if (/\b(accountant|auditor|bookkeep|financial analyst|chartered accountant|cpa)\b/.test(t)) return "finance";
  if (/\b(engineer|developer|programmer|scientist|architect|researcher|dev)\b/.test(t)) return "engineering";
  return "other";
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

export function toAnnualINR(amount: number, currency: string | null, period: string) {
  const rate = CURRENCY_TO_INR[currency ?? "INR"] ?? 1;
  return amount * rate * (period === "month" ? 12 : 1);
}

export function formatSalary(o: { salary_min: number | null; salary_max: number | null; currency: string | null; salary_period: string }) {
  if (o.salary_min == null && o.salary_max == null) return "Not disclosed";
  const cur = o.currency ?? "INR";
  const sym = CURRENCY_SYMBOL[cur] ?? `${cur} `;
  const fmt = (n: number) => {
    if (cur === "INR") return o.salary_period === "month" ? `${(n / 1e5).toFixed(n % 1e5 ? 1 : 0)}L` : `${(n / 1e5).toFixed(n % 1e5 ? 1 : 0)}`;
    return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
  };
  const range = [o.salary_min, o.salary_max].filter((n): n is number => n != null).map(fmt);
  const body = range.length === 2 && range[0] === range[1] ? range[0] : range.join("–");
  if (cur === "INR") return o.salary_period === "month" ? `${sym}${body}/month` : `${sym}${body} LPA`;
  return `${sym}${body}${o.salary_period === "month" ? "/month" : ""}`;
}

/** Parses strings like "₹25–35 LPA", "$90k–130k", "€85k–105k", "S$1500/month", "₹1.5–2L/month". */
export function parseSalary(s: string | null | undefined) {
  const empty = { salary_min: null, salary_max: null, currency: null as string | null, salary_period: "year" };
  if (!s) return empty;
  const text = s.replace(/,/g, "").trim();
  const currency = /S\$/.test(text) ? "SGD" : /₹|inr|lpa|lakh/i.test(text) ? "INR" : /€|eur/i.test(text) ? "EUR"
    : /£|gbp/i.test(text) ? "GBP" : /\$|usd/i.test(text) ? "USD" : "INR";
  const period = /month|\/mo\b|pm\b/i.test(text) ? "month" : "year";
  const parts = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(k|l|lpa|lakh|lakhs)?/gi)];
  const sharedUnit = parts.map((m) => (m[2] ?? "").toLowerCase()).find(Boolean) ?? "";
  const nums = parts.map((m) => {
    const n = parseFloat(m[1]);
    const unit = (m[2] ?? "").toLowerCase() || sharedUnit;
    if (unit === "k") return n * 1000;
    if (unit.startsWith("l")) return n * 1e5;
    if (currency === "INR" && period === "year" && n < 1000) return n * 1e5; // bare "25–35 LPA"
    return n;
  });
  if (!nums.length) return empty;
  return { salary_min: nums[0], salary_max: nums[1] ?? nums[0], currency, salary_period: period };
}

export function canonicalUrl(url: string) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|ref|source|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

export function dedupeKey(company: string, title: string, location: string) {
  const t = normText(title.replace(/\(.*?\)/g, "")).replace(/\b(remote|hybrid|onsite|on-site)\b/g, "").trim();
  return `${normText(company)}|${t}|${normText(location)}`;
}

// ---------- Services ----------

/** Turn a free-text wish ("remote Python/AI jobs in India, 4 years, ₹20 LPA, product companies") into profile fields. */
export function parseSearchProfile(text: string): Partial<Profile> {
  const t = text.toLowerCase();
  const p: Partial<Profile> = {};
  const skills = KNOWN_SKILLS.filter((s) => new RegExp(`(^|[^a-z0-9])${s.toLowerCase().replace(/[.+]/g, "\\$&")}([^a-z0-9]|$)`).test(t));
  if (/\bai\b/.test(t) && !skills.includes("Machine Learning")) skills.push("AI");
  if (skills.length) p.skills = skills;

  const roles: string[] = [];
  // Software
  if (/\b(ai|ml|machine learning)\b/.test(t)) roles.push("AI Engineer", "Machine Learning Engineer");
  if (/\bpython\b/.test(t)) roles.push("Python Developer");
  if (/\bbackend\b/.test(t)) roles.push("Backend Engineer");
  if (/\bfrontend\b/.test(t)) roles.push("Frontend Engineer");
  if (/\bdata (scientist|science)\b/.test(t)) roles.push("Data Scientist");
  if (/\bdata engineer/.test(t)) roles.push("Data Engineer");
  if (/\bfull[\s-]?stack\b/.test(t)) roles.push("Full Stack Engineer");
  if (/\bdevops\b/.test(t)) roles.push("DevOps Engineer");
  // Healthcare, finance, marketing, design, legal, education, HR — best-effort for the one-line prefill.
  if (/\b(nurse|nursing)\b/.test(t)) roles.push("Registered Nurse");
  if (/\b(doctor|physician|medical officer|clinician|mbbs)\b/.test(t)) roles.push("Physician", "Doctor", "Medical Officer");
  if (/\b(pharmacist|pharmacy)\b/.test(t)) roles.push("Pharmacist");
  if (/\b(accountant|accounting)\b/.test(t)) roles.push("Accountant");
  if (/\b(financial analyst|finance)\b/.test(t)) roles.push("Financial Analyst");
  if (/\bmarketing\b/.test(t)) roles.push("Marketing Manager");
  if (/\bsales\b/.test(t)) roles.push("Sales Executive");
  if (/\b(designer|design)\b/.test(t)) roles.push("Designer");
  if (/\b(teacher|teaching|educator)\b/.test(t)) roles.push("Teacher");
  if (/\b(hr|human resources|recruiter)\b/.test(t)) roles.push("HR / Recruiter");
  if (/\b(lawyer|attorney|legal)\b/.test(t)) roles.push("Legal Counsel");
  if (roles.length) p.roles = [...new Set(roles)];

  const yrs = t.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|yoe)/);
  if (yrs) {
    p.years_experience = parseFloat(yrs[1]);
    p.seniority = p.years_experience < 1 ? "junior" : p.years_experience < 3 ? "junior" : p.years_experience < 6 ? "mid" : p.years_experience < 9 ? "senior" : "lead";
  }
  if (/\bsenior\b/.test(t)) p.seniority = "senior";

  const sal = t.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(lpa|lakhs?|l\b)/) ?? t.match(/\$\s*(\d+)\s*k/);
  if (sal) {
    const n = parseFloat(sal[1]);
    if (/\$/.test(sal[0])) { p.salary_min = n * 1000; p.currency = "USD"; } else { p.salary_min = n * 1e5; p.currency = "INR"; }
  }

  const remote: string[] = [];
  if (/\bremote\b/.test(t)) remote.push("remote");
  if (/\bhybrid\b/.test(t)) remote.push("hybrid");
  if (/\b(on-?site|office)\b/.test(t)) remote.push("onsite");
  if (remote.length) p.remote_preference = remote;

  const locs: string[] = [];
  for (const c of ["India", "Singapore", "Germany", "United Kingdom", "United States", "Canada", "Australia", "UAE"])
    if (t.includes(c.toLowerCase())) locs.push(c);
  for (const c of ["Bengaluru", "Bangalore", "Hyderabad", "Pune", "Mumbai", "Chennai", "Delhi", "Gurgaon", "Noida", "Berlin", "London", "San Francisco"])
    if (t.includes(c.toLowerCase())) locs.push(`${c === "Bangalore" ? "Bengaluru" : c}, ${["Berlin"].includes(c) ? "Germany" : ["London"].includes(c) ? "United Kingdom" : c === "San Francisco" ? "United States" : "India"}`);
  if (/\b(global(ly)?|worldwide|anywhere|international(ly)?)\b/.test(t)) locs.push("Global");
  if (locs.length) p.locations = [...new Set(locs)];

  const prefs: string[] = [];
  if (/product compan/.test(t)) prefs.push("product_company");
  if (/\bstartups?\b/.test(t)) prefs.push("startup");
  if (/\bvisa\b|sponsorship/.test(t)) prefs.push("visa_sponsorship");
  if (/remote[\s-]only/.test(t)) prefs.push("remote_only");
  if (prefs.length) p.preferences = prefs;

  const types: string[] = [];
  if (/\bcontract\b|freelance/.test(t)) types.push("contract");
  if (/\bintern(ship)?\b/.test(t)) types.push("internship");
  if (/part[\s-]time/.test(t)) types.push("part-time");
  if (types.length) p.employment_types = [...types, "full-time"];
  return p;
}

type ImportedProfile = Pick<Profile, "roles" | "skills" | "keywords" | "industries" | "locations" | "years_experience" | "current_role" | "education" | "seniority">;

/**
 * Folds a profile read from a resume into what the user already entered: lists gain the new entries
 * (case-insensitive, existing first), and a scalar is replaced only when the resume actually had one.
 */
export function mergeImportedProfile<P extends ImportedProfile>(prev: P, found: ImportedProfile): P {
  const union = (a: string[], b: string[]) => {
    const seen = new Set(a.map((s) => s.toLowerCase()));
    return [...a, ...b.map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))];
  };
  return {
    ...prev,
    roles: union(prev.roles, found.roles),
    skills: union(prev.skills, found.skills),
    keywords: union(prev.keywords, found.keywords),
    industries: union(prev.industries, found.industries),
    locations: union(prev.locations, found.locations),
    years_experience: found.years_experience > 0 ? found.years_experience : prev.years_experience,
    current_role: found.current_role.trim() || prev.current_role,
    education: found.education.trim() || prev.education,
    seniority: found.seniority || prev.seniority,
  };
}

/** Extra JSearch phrasings for roles whose job-board wording varies. */
function searchAliases(role: string): string[] {
  const k = role.toLowerCase();
  if (/\b(physician|doctor|medical officer|clinician)\b/.test(k)) return ["Physician", "Doctor", "Medical Officer"];
  if (/\bnurse\b/.test(k)) return ["Registered Nurse", "Staff Nurse"];
  return [role];
}

/** Roles × locations, capped, so a source adapter can run targeted searches. */
export function generateSearchQueries(p: Profile): SearchQuery[] {
  const roles = p.roles.length ? p.roles : p.skills.length ? p.skills.slice(0, 2) : [];
  const wantsRemote = p.remote_preference.includes("remote") || p.preferences.includes("remote_only");
  const locs = p.locations.length ? p.locations : [""];
  const out: SearchQuery[] = [];
  const seen = new Set<string>();
  const push = (q: SearchQuery) => {
    const key = `${q.q}|${q.location ?? ""}|${q.remote ?? false}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(q);
  };
  for (const r of roles.flatMap(searchAliases).slice(0, 6)) {
    if (wantsRemote) push({ q: r, remote: true });
    for (const l of locs.slice(0, 3)) if (l && l !== "Global") push({ q: r, location: l });
  }
  const head = roles[0] ?? "";
  for (const k of p.keywords.slice(0, 3)) if (head) push({ q: `${k} ${head}`.trim(), remote: wantsRemote });
  return out.slice(0, 12);
}

/** Map a raw source record into the canonical Opportunity shape, inferring what the source didn't supply. */
export function normalizeOpportunity(raw: RawOpportunity): NormalizedOpportunity {
  const desc = raw.description;
  const lower = `${raw.title} ${desc}`.toLowerCase();
  const sal = parseSalary(raw.salary);
  const skills = raw.skills?.length ? raw.skills : KNOWN_SKILLS.filter((s) => new RegExp(`(^|[^a-z0-9])${s.toLowerCase().replace(/[.+/]/g, "\\$&")}([^a-z0-9]|$)`).test(lower)).slice(0, 8);
  const yearsMatch = desc.match(/(\d+)\s*\+?\s*years?/i);
  const tl = raw.title.toLowerCase();
  const seniority = raw.seniority ?? (/\bintern/.test(tl) ? "intern" : /\bjunior|entry/.test(tl) ? "junior" : /\bdirector|head of|vp\b/.test(tl) ? "director"
    : /\bmanager\b/.test(tl) ? "manager" : /\bstaff|principal|lead\b/.test(tl) ? "lead" : /\bsenior|sr\.?\b/.test(tl) ? "senior" : "mid");
  const ll = raw.location.toLowerCase();
  const remote_type = raw.remote_type ?? (/remote/.test(ll) || /fully remote|remote-first/.test(lower) ? "remote" : /hybrid/.test(lower) ? "hybrid" : "onsite");
  const country = raw.country ?? (raw.location.split(/[,—-]/).pop()?.trim() || "");
  const employment_type = (raw.employment_type ?? (/\bintern/.test(tl) ? "internship" : /\bcontract\b/.test(tl) ? "contract" : /part[\s-]time/.test(tl) ? "part-time" : "full-time")).toLowerCase();
  return {
    category: "job",
    title: raw.title.trim(),
    company: raw.company.trim(),
    location: raw.location.trim(),
    country,
    remote_type,
    ...sal,
    description: desc.trim(),
    skills,
    nice_to_have: raw.nice_to_have ?? [],
    min_years: raw.min_years ?? (yearsMatch ? parseInt(yearsMatch[1]) : 0),
    seniority,
    employment_type,
    company_type: raw.company_type ?? "",
    industry: raw.industry ?? "",
    visa_sponsorship: raw.visa_sponsorship ? 1 : 0,
    source: raw.source_name,
    source_url: raw.source_url,
    application_url: raw.application_url,
    posted_date: raw.posted_date,
    canonical_url: canonicalUrl(raw.source_url),
    dedupe_key: dedupeKey(raw.company, raw.title, raw.location),
  };
}

/** Collapse listings that share a canonical URL or (company, normalized title, location). Earliest posting wins. */
export function deduplicateOpportunities<T extends { canonical_url: string; dedupe_key: string; posted_date: string }>(list: T[]): T[] {
  const sorted = [...list].sort((a, b) => a.posted_date.localeCompare(b.posted_date));
  const seen = new Set<string>();
  return sorted.filter((o) => {
    if (seen.has(o.canonical_url) || seen.has(o.dedupe_key)) return false;
    seen.add(o.canonical_url);
    seen.add(o.dedupe_key);
    return true;
  });
}

export function calculateMatchScore(p: Profile, o: NormalizedOpportunity): Breakdown {
  const hay = `${o.title} ${o.company} ${o.description}`.toLowerCase();
  const excluded =
    p.excluded_companies.some((c) => c && o.company.toLowerCase() === c.toLowerCase()) ||
    p.excluded_keywords.some((k) => k && hay.includes(k.toLowerCase()));

  // Skills
  const userSkills = new Set(p.skills.map(normSkill));
  const req = o.skills.map((s) => [s, normSkill(s)] as const);
  const nice = o.nice_to_have.map((s) => [s, normSkill(s)] as const);
  // Covered if the exact normalized skill is present, or a profile skill is semantically close
  // enough. bestSimilarity returns null without embeddings, collapsing to the exact-match path.
  const covered = ([orig, n]: readonly [string, string]) => userSkills.has(n) || (bestSimilarity(p.skills, orig) ?? -1) >= SKILL_SIM;
  const matchedSkills = req.filter(covered).map(([s]) => s);
  const missingSkills = req.filter((x) => !covered(x)).map(([s]) => s);
  const missingNice = nice.filter((x) => !covered(x)).map(([s]) => s);
  const coverage = req.length ? matchedSkills.length / req.length : 0.6;
  const niceHits = nice.length - missingNice.length;
  const relevance = userSkills.size ? Math.min(1, (matchedSkills.length + niceHits) / Math.min(userSkills.size, 6)) : coverage;
  const skills_score = clamp(100 * (0.75 * coverage + 0.25 * relevance));

  // Role
  const titleTok = roleTokens(o.title);
  const titleFam = roleFamily(o.title);
  let role_score = p.roles.length ? 0 : 70;
  let matchedRole: string | null = null;
  for (const r of p.roles) {
    const rt = roleTokens(r);
    const fam = roleFamily(r);
    let s: number;
    if (!rt.size) s = fam === titleFam ? 70 : 30;
    else {
      const hit = [...rt].filter((t) => titleTok.has(t)).length;
      s = hit === rt.size ? 100 : hit ? 40 + (60 * hit) / rt.size : [...rt].some((t) => hay.includes(t)) ? 35 : 15;
    }
    if (fam !== titleFam && fam !== "other" && titleFam !== "other") s = Math.min(s, 40);
    if (s > role_score) { role_score = s; matchedRole = r; }
  }
  if (p.keywords.some((k) => k && o.title.toLowerCase().includes(k.toLowerCase()))) role_score = Math.max(role_score, 60);
  // Semantic floor: a title close to any profile role lifts the score even with no shared tokens.
  // Skipped when the families genuinely differ, so it never revives a cross-domain match.
  const roleSim = bestSimilarity(p.roles, o.title);
  if (roleSim != null && roleSim >= ROLE_SIM && (titleFam === "other" || p.roles.some((r) => roleFamily(r) === titleFam)))
    role_score = Math.max(role_score, 50 + 100 * (roleSim - ROLE_SIM));
  role_score = clamp(role_score);

  // Experience & seniority
  const u = p.years_experience, m = o.min_years;
  let exp = u >= m ? (u - m <= 4 ? 100 : 85) : Math.max(20, 100 - (m - u) * 25);
  const sd = Math.abs((SENIORITY_RANK[o.seniority] ?? 2) - (SENIORITY_RANK[p.seniority] ?? 2));
  exp -= sd * 15;
  const experience_score = clamp(exp);

  // Location
  const remoteOnly = p.preferences.includes("remote_only");
  const wantsRemote = remoteOnly || p.remote_preference.includes("remote");
  const userLocTokens = p.locations.flatMap((l) => l.split(/[,—-]/).map((s) => s.trim().toLowerCase())).filter(Boolean);
  const oppLocTokens = [o.location, o.country].flatMap((l) => l.split(/[,—-]/).map((s) => s.trim().toLowerCase())).filter(Boolean);
  const locHit = userLocTokens.some((t) => oppLocTokens.includes(t) || (t === "bangalore" && oppLocTokens.includes("bengaluru")));
  const global = o.country.toLowerCase() === "global" || userLocTokens.includes("global") || userLocTokens.includes("anywhere");
  let location_score: number;
  if (o.remote_type === "remote") location_score = wantsRemote ? (global || locHit || !p.locations.length ? 100 : 70) : 60;
  else if (remoteOnly) location_score = 15;
  // A profile listing "Global"/"anywhere" accepts on-site roles anywhere, though a literal location match still ranks higher.
  else if (locHit || !p.locations.length) location_score = p.remote_preference.includes(o.remote_type) || !p.remote_preference.length ? 100 : 75;
  else if (global) location_score = 60;
  else location_score = 25;

  // Salary
  let salary_score: number;
  if (o.salary_max == null && o.salary_min == null) salary_score = 70;
  else if (p.salary_min == null) salary_score = 100;
  else {
    const userMin = toAnnualINR(p.salary_min, p.currency, p.salary_period);
    const oMax = toAnnualINR(o.salary_max ?? o.salary_min!, o.currency, o.salary_period);
    const oMin = toAnnualINR(o.salary_min ?? o.salary_max!, o.currency, o.salary_period);
    if (oMax >= userMin) salary_score = oMin >= userMin ? 100 : clamp(70 + 30 * ((oMax - userMin) / Math.max(1, oMax - oMin)));
    else salary_score = clamp((oMax / userMin) * 70);
  }

  // Employment type & preferences
  const typeMismatch = p.employment_types.length > 0 && !p.employment_types.includes(o.employment_type);
  let adj = 0;
  if (p.preferences.includes("product_company")) adj += o.company_type === "product" ? 3 : o.company_type === "services" ? -8 : 0;
  if (p.preferences.includes("startup") && o.company_type === "startup") adj += 3;
  if (p.preferences.includes("visa_sponsorship") && !locHit && !global && o.remote_type !== "remote" && !o.visa_sponsorship) adj -= 15;
  if (p.companies.some((c) => c && o.company.toLowerCase() === c.toLowerCase())) adj += 5;
  if (p.industries.some((i) => i && o.industry.toLowerCase().includes(i.toLowerCase()))) adj += 3;
  // Whole-profile vs whole-listing semantic nudge: refines ranking between otherwise-similar scores,
  // deliberately small (−3..+5) so it never overrides the structured components. Null without embeddings.
  const docSim = similarity(profileSummaryText(p), o.description);
  if (docSim != null) adj += Math.max(-3, Math.min(5, Math.round((docSim - 0.4) * 20)));

  let score = 0.3 * skills_score + 0.25 * role_score + 0.15 * experience_score + 0.15 * location_score + 0.15 * salary_score + adj;
  if (typeMismatch) score *= 0.6;
  const profileFams = p.roles.map(roleFamily).filter((f) => f !== "other");
  if (profileFams.length && titleFam !== "other" && !profileFams.includes(titleFam)) score = Math.min(score, 32);
  if (excluded) score = 0;

  return { score: clamp(score), skills_score, role_score, experience_score, location_score, salary_score, excluded,
    matchedSkills, missingSkills, missingNice, matchedRole, typeMismatch, locHit, globalScope: global };
}

export function generateMatchExplanation(p: Profile, o: NormalizedOpportunity, b: Breakdown): Explanation {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const list = (a: string[]) => (a.length <= 2 ? a.join(" and ") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

  if (b.matchedSkills.length) {
    const shown = b.matchedSkills.slice(0, 4);
    strengths.push(`${list(shown)} ${shown.length === 1 ? "matches" : "match"} your ${b.matchedSkills.length >= 3 ? "core " : ""}skills`);
  }
  if (b.role_score >= 80 && b.matchedRole) strengths.push(`Title matches your target role: ${b.matchedRole}`);
  else if (b.role_score < 45) gaps.push(`Role is outside your target titles${p.roles.length ? ` (${p.roles[0]}…)` : ""}`);

  if (p.years_experience >= o.min_years) {
    if (o.min_years > 0) strengths.push(`Requires ${o.min_years}+ years — you have ${p.years_experience}`);
    if (p.years_experience - o.min_years > 4) gaps.push(`May be junior for your ${p.years_experience} years of experience`);
  } else gaps.push(`Asks for ${o.min_years}+ years; you have ${p.years_experience}`);
  const sd = (SENIORITY_RANK[o.seniority] ?? 2) - (SENIORITY_RANK[p.seniority] ?? 2);
  if (Math.abs(sd) >= 2) gaps.push(`${o.seniority.charAt(0).toUpperCase() + o.seniority.slice(1)}-level role vs your ${p.seniority} seniority`);

  if (o.remote_type === "remote") {
    if (b.location_score >= 70) strengths.push(o.country === "Global" ? "Remote, open globally" : `Remote position (${o.country})`);
    else gaps.push("Remote role; you prefer hybrid or on-site");
  } else {
    const kind = o.remote_type === "hybrid" ? "Hybrid" : "On-site";
    if (!p.locations.length) strengths.push(`${kind} in ${o.location}`);
    else if (b.locHit) strengths.push(`${kind} in ${o.location}, one of your locations`);
    else if (b.globalScope) gaps.push(`${kind} in ${o.location} — you're open globally, but this needs you on site`);
    else gaps.push(`${kind} in ${o.location}, outside your locations`);
  }

  const sal = formatSalary(o);
  // Most feeds omit pay, so this note is deferred to the end of the list rather than crowding out real gaps.
  const undisclosed = o.salary_min == null && o.salary_max == null;
  if (!undisclosed) {
    if (b.salary_score === 100) strengths.push(`Salary ${sal} is within your target range`);
    else if (b.salary_score >= 70) strengths.push(`Salary ${sal} overlaps your target range`);
    else gaps.push(`Salary ${sal} is below your minimum`);
  }

  for (const s of b.missingSkills.slice(0, 3)) gaps.push(`Requires ${s} experience`);
  for (const s of b.missingNice.slice(0, 2)) gaps.push(`${s} experience is a plus`);

  if (b.typeMismatch) gaps.push(`${o.employment_type.charAt(0).toUpperCase() + o.employment_type.slice(1)} role; you prefer ${list(p.employment_types)}`);
  if (p.preferences.includes("product_company")) {
    if (o.company_type === "product") strengths.push("Product company, matching your preference");
    else if (o.company_type === "services") gaps.push("Services company; you prefer product companies");
  }
  if (p.preferences.includes("startup") && o.company_type === "startup") strengths.push("Startup, matching your preference");
  if (p.preferences.includes("visa_sponsorship") && o.visa_sponsorship) strengths.push("Offers visa sponsorship");
  if (p.companies.some((c) => c.toLowerCase() === o.company.toLowerCase())) strengths.push("One of your target companies");
  if (undisclosed) gaps.push("Salary not disclosed");

  const shortfall = Math.max(0, o.min_years - p.years_experience);
  let difficulty: Explanation["difficulty"] = "low";
  let difficultyReason = "You meet the stated requirements.";
  if (b.missingSkills.length >= 2 || shortfall >= 2 || Math.abs(sd) >= 2) {
    difficulty = "high";
    difficultyReason = b.missingSkills.length >= 2 ? `Missing ${b.missingSkills.length} required skills.` : shortfall >= 2 ? `${shortfall} years short of the requirement.` : "Seniority is far from your level.";
  } else if (b.missingSkills.length === 1 || shortfall === 1 || ["lead", "manager", "director"].includes(o.seniority)) {
    difficulty = "medium";
    difficultyReason = b.missingSkills.length ? `One required skill (${b.missingSkills[0]}) to address.` : shortfall ? "One year short of the stated experience." : "Senior role; expect a rigorous process.";
  }
  return { strengths: strengths.slice(0, 6), gaps: gaps.slice(0, 5), difficulty, difficultyReason };
}

export function recommendNextAction(score: number, e: Explanation): NextAction {
  if (score >= 85) return { action: "apply", label: "Apply Now", reason: "Strong match across skills, role and preferences." };
  if (score >= 70) return { action: "apply", label: "Apply Now", reason: e.gaps.length ? `Good match — address "${e.gaps[0]}" in your application.` : "Good match." };
  if (score >= 50) return { action: "consider", label: "Consider", reason: "Partial match. Apply only if the gaps are acceptable to you." };
  return { action: "skip", label: "Skip", reason: "Weak match. Your time is better spent elsewhere." };
}

export type ApplicationDraft = { letter: string; talkingPoints: string[]; prepare: string[] };

/**
 * Draft an application the user edits and sends themselves — the app never submits anything.
 * Anything the profile can't supply is left as a bracketed placeholder rather than invented,
 * since this goes out under the user's name.
 */
export function generateApplicationDraft(
  name: string,
  p: Profile,
  o: NormalizedOpportunity,
  b: Breakdown,
  e: Explanation,
): ApplicationDraft {
  const list = (a: string[]) => (a.length <= 2 ? a.join(" and ") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
  const top = b.matchedSkills.slice(0, 3);
  const role = p.current_role || p.roles[0] || "professional";
  const years = p.years_experience;

  const lines = [`Hi ${o.company} team,`, ""];
  const article = /^[aeiou]/i.test(role) ? "an" : "a";
  const intro = `I'm applying for the ${o.title} role. I'm ${article} ${role}${years ? ` with ${years} ${years === 1 ? "year" : "years"} of experience` : ""}`;
  // With no overlapping skills there is nothing true to claim, so say nothing rather than assert a fit.
  lines.push(top.length ? `${intro}, and I work day to day with ${list(top)}.` : `${intro}.`);
  lines.push("");
  if (top.length) {
    lines.push(`A couple of specifics: [one line on a project where you used ${top[0]} — what you built and the outcome].`);
    if (top[1]) lines.push(`[one line on ${top[1]} — ideally something measurable].`);
    lines.push("");
  }
  // Address a missing *requirement* head-on — unacknowledged, it reads worse. Never volunteer a
  // weakness about a nice-to-have; that's talking yourself down over something optional.
  const gap = b.missingSkills[0];
  if (gap) {
    lines.push(`I haven't worked with ${gap} in production, though [note the closest thing you have done, or how quickly you picked up something comparable]. Happy to talk through it.`);
    lines.push("");
  }
  if (o.remote_type === "remote" && p.remote_preference.includes("remote")) lines.push("I'm set up to work remotely and used to async collaboration.");
  else if (b.locHit) lines.push(`I'm based in ${p.locations[0]}, so the location works well.`);
  lines.push("", "Thanks for your time,", name);
  const letter = lines.join("\n").replace(/\n{3,}/g, "\n\n");

  const talkingPoints = [
    top[0] ? `${top[0]} — have a concrete example ready: what you built and the outcome` : null,
    top.length > 1 ? `Also be ready to speak to ${list(top.slice(1))}` : null,
    b.role_score >= 80 && b.matchedRole ? `Title maps to your target: ${b.matchedRole}` : null,
    years >= o.min_years && o.min_years > 0 ? `Meets the ${o.min_years}+ years requirement (you have ${years})` : null,
    o.company_type === "startup" ? "Startup — expect questions on ownership and moving without process" : null,
    o.company_type === "product" ? "Product company — expect questions on users and trade-offs, not just delivery" : null,
  ].filter((x): x is string => Boolean(x));

  const prepare = [
    ...b.missingSkills.slice(0, 3).map((s) => `${s} is required — be ready to say honestly where you are with it`),
    ...b.missingNice.slice(0, 2).map((s) => `${s} is a nice-to-have — worth a sentence if you've touched it`),
    e.difficulty === "high" ? "Rigorous fit: lead with the overlap early in the conversation" : null,
    o.salary_min == null ? "Pay isn't listed — decide your number before they ask" : null,
  ].filter((x): x is string => Boolean(x));

  return { letter, talkingPoints, prepare };
}

export function generateDailyDigest(
  name: string,
  matches: { id: number; title: string; company: string; score: number }[],
  appUrl: string,
) {
  const excellent = matches.filter((m) => m.score >= 85).length;
  const good = matches.filter((m) => m.score >= 70 && m.score < 85).length;
  const top = [...matches].sort((a, b) => b.score - a.score)[0];
  const subject = `Your Opportunity Hunter Report: ${matches.length} new ${matches.length === 1 ? "opportunity" : "opportunities"}`;
  const lines = [
    `Hi ${name.split(" ")[0]},`,
    ``,
    `You found ${matches.length} new ${matches.length === 1 ? "opportunity" : "opportunities"} today.`,
    `🔥 ${excellent} excellent ${excellent === 1 ? "match" : "matches"}`,
    `⭐ ${good} good ${good === 1 ? "match" : "matches"}`,
  ];
  if (top) lines.push(``, `Top match:`, `${top.title} — ${top.company}`, `${top.score}% Match`, `${appUrl}/opportunities/${top.id}`);
  lines.push(``, `See everything: ${appUrl}/opportunities`);
  const text = lines.join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px"><p>Hi ${name.split(" ")[0]},</p>
<p>You found <strong>${matches.length}</strong> new opportunities today.</p>
<p>🔥 ${excellent} excellent matches<br/>⭐ ${good} good matches</p>
${top ? `<p><strong>Top match</strong><br/>${top.title} — ${top.company}<br/><span style="color:#059669">${top.score}% Match</span></p>
<p><a href="${appUrl}/opportunities/${top.id}" style="background:#18181b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">View Opportunity</a></p>` : ""}
<p style="color:#71717a;font-size:12px">Opportunity Hunter · <a href="${appUrl}/alerts">Manage alerts</a></p></div>`;
  return { subject, text, html, excellent, good, top };
}
