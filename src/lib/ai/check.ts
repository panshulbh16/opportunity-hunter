// Self-check for the matching engine: `npm run check`. Fails loudly if scoring/dedupe/parsing regress.
import assert from "node:assert/strict";
import {
  calculateMatchScore, deduplicateOpportunities, mergeImportedProfile, generateApplicationDraft, generateMatchExplanation, generateSearchQueries, normalizeOpportunity, parseSalary,
  parseSearchProfile, recommendNextAction, type Profile,
} from "./index.ts";
import { demoSource } from "../sources/demo.ts";
import { pickApply } from "../sources/jsearch.ts";
import { looksLikePdf } from "./resume.ts";
import { classifyLinkStatus } from "../linkcheck.ts";

const profile: Profile = {
  roles: ["AI Engineer", "Machine Learning Engineer", "Python Developer"],
  skills: ["Python", "RAG", "Vector Database", "LLM", "AWS"],
  keywords: [], industries: [], companies: [], excluded_companies: ["Sable Systems"], excluded_keywords: [],
  years_experience: 4, current_role: "AI Engineer", education: "B.Tech", seniority: "mid",
  locations: ["India"], remote_preference: ["remote"], salary_min: 2000000, salary_max: null, currency: "INR",
  salary_period: "year", employment_types: ["full-time"], preferences: ["product_company"],
  notification_threshold: 80, search_frequency: "daily",
};

const raws = await demoSource.fetch([]);
const opps = deduplicateOpportunities(raws.map(normalizeOpportunity));
assert.equal(raws.length, 31, "demo source ships 30 jobs + 1 duplicate");
assert.equal(opps.length, 30, "duplicate collapsed by dedupe key");

const byTitle = (t: string) => opps.find((o) => o.title === t)!;
const score = (t: string) => calculateMatchScore(profile, byTitle(t));

assert.ok(score("Senior Python AI Engineer").score >= 85, "flagship job is an excellent match");
assert.ok(score("Frontend Engineer — React").score < 50, "unrelated stack scores low");
assert.equal(score("Python Developer").score, 0, "excluded company scores zero");
assert.ok(score("Product Manager — AI").role_score <= 40, "management title capped for engineering roles");
assert.ok(score("Contract Python Developer (6 months)").score < score("Python Engineer — Data Platform").score, "type mismatch penalised");
assert.ok(score("Java Backend Developer").score < 45, "wrong language + wrong location + low salary");

const b = score("Senior Python AI Engineer");
const e = generateMatchExplanation(profile, byTitle("Senior Python AI Engineer"), b);
assert.ok(e.strengths.some((s) => s.includes("Python")), "explanation names matched skills");
assert.ok(e.gaps.some((s) => s.includes("Kubernetes")), "explanation names nice-to-have gap");
assert.equal(recommendNextAction(b.score, e).action, "apply");

// Explanation wording: singular vs plural skills, and salary-not-disclosed deferred behind real gaps.
const single = generateMatchExplanation(profile, byTitle("Java Backend Developer"), score("Java Backend Developer"));
assert.ok(!single.strengths.concat(single.gaps).some((s) => /\b\w+ match your skills/.test(s)), "single skill reads 'matches'");
const undisclosed = { ...byTitle("Senior Python AI Engineer"), salary_min: null, salary_max: null };
const ue = generateMatchExplanation(profile, undisclosed, calculateMatchScore(profile, undisclosed));
assert.equal(ue.gaps.at(-1), "Salary not disclosed", "undisclosed salary is the last gap, not the first");
assert.ok(ue.gaps.length > 1, "real gaps still surface alongside it");

// A profile open "globally" shouldn't be told an on-site role is outside its locations.
const globalProfile: Profile = { ...profile, locations: ["India", "Global"] };
const abroad = byTitle("Machine Learning Engineer — Computer Vision"); // Singapore, on-site
const ge = generateMatchExplanation(globalProfile, abroad, calculateMatchScore(globalProfile, abroad));
assert.ok(!ge.gaps.some((g) => g.includes("outside your locations")), "global scope is not 'outside your locations'");
assert.ok(calculateMatchScore(globalProfile, abroad).location_score > calculateMatchScore(profile, abroad).location_score, "global scope scores above a plain mismatch");

// Application draft: uses real profile facts, never invents achievements.
const flagship = byTitle("Senior Python AI Engineer");
const fb = score("Senior Python AI Engineer");
const draft = generateApplicationDraft("Asha Rao", profile, flagship, fb, generateMatchExplanation(profile, flagship, fb));
assert.ok(draft.letter.includes("Northwind Labs") && draft.letter.includes("Senior Python AI Engineer"), "names the company and role");
assert.ok(draft.letter.endsWith("Asha Rao"), "signs off with the applicant's name");
assert.ok(draft.letter.includes("Python"), "cites a genuinely matched skill");
assert.ok(/\[[^\]]+\]/.test(draft.letter), "leaves placeholders instead of inventing specifics");
assert.ok(draft.prepare.some((p) => p.includes("AWS") || p.includes("Kubernetes")), "flags the real gaps to prepare for");
const noSalary = { ...flagship, salary_min: null, salary_max: null };
assert.ok(generateApplicationDraft("Asha Rao", profile, noSalary, calculateMatchScore(profile, noSalary), generateMatchExplanation(profile, noSalary, calculateMatchScore(profile, noSalary)))
  .prepare.some((p) => p.includes("Pay isn't listed")), "undisclosed pay becomes a prep note");
// A poor match must not assert a fit that isn't there, and must not apologise for optional skills.
const weak = byTitle("Senior Backend Engineer (Go)");
const wd = generateApplicationDraft("Asha Rao", profile, weak, score("Senior Backend Engineer (Go)"), generateMatchExplanation(profile, weak, score("Senior Backend Engineer (Go)")));
assert.ok(!/line up closely/.test(wd.letter), "no invented claim of fit when nothing matches");
assert.ok(!/\n{3,}/.test(wd.letter), "no stray blank runs");
assert.ok(!/haven't worked with (AWS|Kubernetes) in production/.test(draft.letter), "never volunteers weakness about a nice-to-have");

assert.deepEqual(parseSalary("₹25–35 LPA"), { salary_min: 2500000, salary_max: 3500000, currency: "INR", salary_period: "year" });
assert.deepEqual(parseSalary("$90k–130k"), { salary_min: 90000, salary_max: 130000, currency: "USD", salary_period: "year" });
assert.deepEqual(parseSalary("S$1500/month"), { salary_min: 1500, salary_max: 1500, currency: "SGD", salary_period: "month" });
assert.deepEqual(parseSalary("₹1.5–2L/month"), { salary_min: 150000, salary_max: 200000, currency: "INR", salary_period: "month" });

const parsed = parseSearchProfile("Find remote Python/AI jobs in India or globally. I have 4 years of experience. Minimum salary ₹20 LPA. Prefer product companies.");
assert.equal(parsed.years_experience, 4);
assert.equal(parsed.salary_min, 2000000);
assert.deepEqual(parsed.remote_preference, ["remote"]);
assert.ok(parsed.roles?.includes("AI Engineer"));
assert.ok(parsed.locations?.includes("India") && parsed.locations?.includes("Global"));
assert.deepEqual(parsed.preferences, ["product_company"]);

// Apply links: Jobrapido previews expire (404), so the employer's own page, any other publisher, or Google Jobs wins.
const JR = "https://in.jobrapido.com/jobpreview/1?trk=bingjobs", G = "https://www.google.com/search?ibp=htl;jobs&q=x";
assert.equal(pickApply({ job_publisher: "Jobrapido", job_apply_link: JR, job_google_link: G, apply_options: [
  { publisher: "Jobrapido", apply_link: JR }, { publisher: "LinkedIn", apply_link: "https://in.linkedin.com/jobs/view/1" },
  { publisher: "Acme Careers", apply_link: "https://careers.acme.com/1", is_direct: true }] }).url, "https://careers.acme.com/1", "direct employer link first");
assert.equal(pickApply({ job_publisher: "Jobrapido", job_apply_link: JR, job_google_link: G, apply_options: [{ publisher: "Jobrapido", apply_link: JR }] }).url, G, "Jobrapido-only falls back to Google Jobs");
assert.equal(pickApply({ job_publisher: "LinkedIn", job_apply_link: "https://in.linkedin.com/jobs/view/2" }).url, "https://in.linkedin.com/jobs/view/2", "good main link kept");

// Resume import: lists gain new entries without duplicates (case-insensitive); scalars change only when the resume had one.
const before = { roles: ["AI Engineer"], skills: ["Python", "aws"], keywords: [], industries: [], locations: ["India"], years_experience: 4, current_role: "Engineer at Acme", education: "", seniority: "mid" };
const merged = mergeImportedProfile(before, { roles: ["ai engineer", "ML Engineer"], skills: ["AWS", "RAG", " "], keywords: ["GenAI"], industries: ["Fintech"], locations: [], years_experience: 0, current_role: "", education: "B.Tech CS", seniority: "senior" });
assert.deepEqual(merged.roles, ["AI Engineer", "ML Engineer"], "no duplicate role, existing first");
assert.deepEqual(merged.skills, ["Python", "aws", "RAG"], "AWS deduped against aws; blanks dropped");
assert.equal(merged.years_experience, 4, "resume without years keeps the entered value");
assert.equal(merged.current_role, "Engineer at Acme", "empty current_role doesn't wipe the entered one");
assert.equal(merged.education, "B.Tech CS");
assert.equal(merged.seniority, "senior");
assert.ok(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n...")) && !looksLikePdf(new TextEncoder().encode("PK\u0003\u0004 docx")), "only real PDFs pass");

// Dead apply links: only a real "gone" hides a listing. Bot blocks and rate limits must not.
assert.equal(classifyLinkStatus(404), "closed");
assert.equal(classifyLinkStatus(410), "closed");
assert.equal(classifyLinkStatus(200), "alive");
assert.equal(classifyLinkStatus(301), "alive");
for (const blocked of [401, 403, 429, 500, 0]) assert.equal(classifyLinkStatus(blocked), "unknown", `${blocked} is not proof the job is gone`);

// Doctor / physician search: don't fall back to "software engineer", and don't match SWE listings.
const doctorWish = parseSearchProfile("Doctor jobs in Mumbai, 5 years, MBBS. Minimum salary ₹12 LPA.");
assert.ok(doctorWish.roles?.some((r) => /physician|doctor|medical officer/i.test(r)), "free-text 'doctor' becomes a medical role");
assert.ok(doctorWish.locations?.some((l) => /Mumbai/i.test(l)));
const doctorProfile: Profile = {
  ...profile,
  roles: ["Physician", "Doctor"],
  skills: ["Patient Care", "MBBS", "Clinical Practice", "ACLS", "BLS"],
  keywords: [], industries: ["Healthcare"], companies: [], excluded_companies: [], excluded_keywords: [],
  years_experience: 5, current_role: "Physician", education: "MBBS", seniority: "mid",
  locations: ["Mumbai, India"], remote_preference: ["onsite"], salary_min: 1200000, salary_max: null, currency: "INR",
  salary_period: "year", employment_types: ["full-time"], preferences: [],
};
const doctorQs = generateSearchQueries(doctorProfile);
assert.ok(doctorQs.some((q) => /physician|doctor|medical officer/i.test(q.q)), "JSearch queries use doctor/physician wording");
assert.ok(!doctorQs.some((q) => /engineer/i.test(q.q)), "doctor hunt must not search for engineers");
const skillOnly = generateSearchQueries({ ...doctorProfile, roles: [], skills: ["Patient Care"] });
assert.ok(skillOnly.every((q) => !/engineer/i.test(q.q)), "empty titles + a clinical skill is not '{skill} engineer'");
assert.ok(calculateMatchScore(doctorProfile, byTitle("Senior Python AI Engineer")).score < 40, "a doctor profile must not match a software job");
const ward = normalizeOpportunity({
  source_name: "test", source_url: "https://example.com/physician", title: "Consultant Physician — Internal Medicine",
  company: "City Hospital", location: "Mumbai, India", salary: "₹12–18 LPA",
  description: "MBBS MD Internal Medicine. OPD and IPD patient care, ACLS, BLS. 3+ years as a physician or medical officer.",
  posted_date: "2026-06-01", application_url: "https://example.com/physician", employment_type: "full-time",
  country: "India", remote_type: "onsite", industry: "Healthcare",
});
assert.ok(calculateMatchScore(doctorProfile, ward).score >= 70, "physician listing scores well for a doctor profile");
assert.ok(calculateMatchScore(doctorProfile, ward).role_score >= 80, "Doctor/Physician aliases match a consultant physician title");

console.log("ai check ok —", opps.length, "opportunities, flagship score", b.score);
