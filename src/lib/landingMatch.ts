import {
  calculateMatchScore, formatSalary, generateMatchExplanation, normalizeOpportunity, type Profile,
} from "./ai/index.ts";
import { warmForScoring } from "./ai/embeddings.ts";
import type { ResumeProfile } from "./ai/resume.ts";
import type { RawOpportunity } from "./sources/types.ts";

/** Resume-shaped defaults used when the visitor has not imported a CV yet. */
export const SAMPLE_RESUME: ResumeProfile = {
  roles: ["Software Engineer", "Backend Engineer"],
  skills: ["Python", "TypeScript", "PostgreSQL", "AWS", "REST APIs"],
  keywords: ["backend", "APIs"],
  industries: ["Technology"],
  locations: ["Bengaluru, India"],
  years_experience: 4,
  current_role: "Backend Engineer at Northwind Labs",
  education: "B.Tech Computer Science",
  seniority: "mid",
};

const BACKEND_JOB: RawOpportunity = {
  source_name: "example", source_url: "https://opportunityhunter.xyz/signup",
  title: "Software Engineer — Backend", company: "Northwind Labs", location: "Bengaluru, India",
  salary: "₹25–35 LPA",
  description: "Python and TypeScript backend for product APIs. PostgreSQL, AWS, REST. 4+ years. On-call rotation.",
  posted_date: "2026-09-01", application_url: "/signup", employment_type: "full-time",
  skills: ["Python", "TypeScript", "PostgreSQL", "AWS"], nice_to_have: ["Kubernetes"],
  min_years: 4, seniority: "mid", remote_type: "hybrid", country: "India", company_type: "product", industry: "Technology",
};

const CLINICAL_JOB: RawOpportunity = {
  source_name: "example", source_url: "https://opportunityhunter.xyz/signup",
  title: "Consultant Physician — Internal Medicine", company: "City Hospital", location: "Mumbai, India",
  salary: "₹12–18 LPA",
  description: "MBBS MD Internal Medicine. OPD and IPD patient care, ACLS, BLS. 3+ years as a physician or medical officer.",
  posted_date: "2026-09-01", application_url: "/signup", employment_type: "full-time",
  skills: ["Patient Care", "MBBS", "Clinical Practice", "ACLS", "BLS"], nice_to_have: ["MD"],
  min_years: 3, seniority: "mid", remote_type: "onsite", country: "India", company_type: "enterprise", industry: "Healthcare",
};

export function profileFromResume(r: ResumeProfile): Profile {
  return {
    roles: r.roles, skills: r.skills, keywords: r.keywords, industries: r.industries, companies: [],
    excluded_companies: [], excluded_keywords: [], years_experience: r.years_experience,
    current_role: r.current_role, education: r.education, seniority: r.seniority, locations: r.locations,
    remote_preference: ["remote", "hybrid", "onsite"], salary_min: null, salary_max: null, currency: "INR",
    salary_period: "year", employment_types: ["full-time"], preferences: [], notification_threshold: 80, search_frequency: "daily",
  };
}

function jobFor(profile: Profile) {
  const hay = `${profile.roles.join(" ")} ${profile.current_role} ${profile.skills.join(" ")}`.toLowerCase();
  const clinical = /physician|doctor|nurse|mbbs|patient care|clinical|medical officer/.test(hay);
  return normalizeOpportunity(clinical ? CLINICAL_JOB : BACKEND_JOB);
}

export type LandingMatchView = {
  title: string;
  company: string;
  location: string;
  salary: string;
  employment: string;
  score: number;
  strengths: string[];
  gaps: string[];
  caption: string;
  ctaHref: string;
  ctaLabel: string;
};

export function matchCaption(p: Profile, kind: "sample" | "resume" | "profile") {
  const who = [p.current_role || p.roles[0], p.years_experience ? `${p.years_experience} years` : "", p.education].filter(Boolean).join(" · ");
  if (kind === "resume") return `Scored from your resume${who ? `: ${who}` : ""}.`;
  if (kind === "profile") return `Scored against your search profile${who ? `: ${who}` : ""}.`;
  return `Scored from this resume: ${who}. Upload yours to replace the sample.`;
}

export async function scoreAgainstProfile(profile: Profile, kind: "sample" | "resume" | "profile", cta?: { href: string; label: string }): Promise<LandingMatchView> {
  const job = jobFor(profile);
  await warmForScoring(profile, [job]);
  const b = calculateMatchScore(profile, job);
  const e = generateMatchExplanation(profile, job, b);
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    salary: formatSalary(job) || "Salary not listed",
    employment: job.employment_type === "full-time" ? "Full-time" : job.employment_type,
    score: b.score,
    strengths: e.strengths.slice(0, 4),
    gaps: e.gaps.slice(0, 2),
    caption: matchCaption(profile, kind),
    ctaHref: cta?.href ?? "/signup",
    ctaLabel: cta?.label ?? "Start Hunting Free",
  };
}

export function sampleLandingMatch(): Promise<LandingMatchView> {
  return scoreAgainstProfile(profileFromResume(SAMPLE_RESUME), "sample");
}
