// Self-check for the matching engine: `npm run check`. Fails loudly if scoring/dedupe/parsing regress.
import assert from "node:assert/strict";
import {
  calculateMatchScore, deduplicateOpportunities, generateMatchExplanation, normalizeOpportunity, parseSalary,
  parseSearchProfile, recommendNextAction, type Profile,
} from "./index.ts";
import { demoSource } from "../sources/demo.ts";

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

console.log("ai check ok —", opps.length, "opportunities, flagship score", b.score);
