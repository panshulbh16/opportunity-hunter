"use client";

import { useActionState, useState, useTransition } from "react";
import { importResume, saveProfile, type ActionState } from "@/app/actions";
import { mergeImportedProfile, parseSearchProfile, type Profile } from "@/lib/ai";
import { TagInput } from "./TagInput";
import { Alert } from "./ui";
import { RunSearchButton } from "./RunSearchButton";

export type ProfileValues = Omit<Profile, "salary_min" | "salary_max"> & { salary_min: number | null; salary_max: number | null; digest_enabled?: number };

export const EMPTY_PROFILE: ProfileValues = {
  roles: [], skills: [], keywords: [], industries: [], companies: [], excluded_companies: [], excluded_keywords: [],
  years_experience: 0, current_role: "", education: "", seniority: "mid", locations: [], remote_preference: ["remote"],
  salary_min: null, salary_max: null, currency: "INR", salary_period: "year", employment_types: ["full-time"],
  preferences: [], notification_threshold: 80, search_frequency: "daily", digest_enabled: 1,
};

const ROLE_SUGGESTIONS = ["Software Engineer", "Registered Nurse", "Accountant", "Marketing Manager", "Product Designer", "Sales Executive", "Physician", "Data Analyst", "Teacher", "HR Manager", "Financial Analyst", "Project Manager"];
const LOCATION_SUGGESTIONS = ["India", "Global", "Bengaluru, India", "Hyderabad, India", "Pune, India", "Mumbai, India", "Delhi NCR, India", "Singapore", "Berlin, Germany", "London, United Kingdom", "United States"];
const INDUSTRY_SUGGESTIONS = ["Healthcare", "Finance", "Technology", "Education", "Retail", "Marketing & Advertising", "Manufacturing", "Legal", "Hospitality", "Consulting"];
const SKILL_SUGGESTIONS = ["Patient Care", "Microsoft Excel", "SEO", "Figma", "Accounting", "Project Management", "Salesforce", "Python", "Data Analysis", "Copywriting", "Nursing", "Financial Analysis", "Graphic Design", "Recruiting", "Customer Service", "Agile"];
const SENIORITIES = ["intern", "junior", "mid", "senior", "lead", "manager", "director"];
const STEPS = ["What are you looking for?", "Experience", "Location", "Compensation", "Preferences", "Search frequency"];

function FormSection({ visible, onboarding, title, hint, children }: { visible: boolean; onboarding: boolean; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section hidden={!visible} className={onboarding ? "fade-in" : "card p-6"}>
      <h2 className={onboarding ? "text-2xl font-semibold tracking-tight text-zinc-900" : "text-base font-semibold text-zinc-900"}>{title}</h2>
      {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

export function ProfileForm({ initial, mode, resumeImport = false }: { initial: ProfileValues; mode: "onboarding" | "edit"; resumeImport?: boolean }) {
  const [v, setV] = useState<ProfileValues>(initial);
  const [step, setStep] = useState(0);
  const [wish, setWish] = useState("");
  const [unspecified, setUnspecified] = useState(initial.salary_min == null && initial.salary_max == null && mode === "edit");
  const [state, formAction, pending] = useActionState(saveProfile, undefined as ActionState);
  const [importing, startImport] = useTransition();
  const [imported, setImported] = useState<{ kind: "success" | "error"; text: string }>();
  const set = <K extends keyof ProfileValues>(k: K) => (val: ProfileValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const toggle = (k: "remote_preference" | "employment_types" | "preferences", val: string) =>
    setV((p) => ({ ...p, [k]: p[k].includes(val) ? p[k].filter((x) => x !== val) : [...p[k], val] }));
  const scale = v.currency === "INR" ? 1e5 : 1;
  const onboarding = mode === "onboarding";
  const show = (i: number) => !onboarding || step === i;
  const canNext = step !== 0 || v.roles.length > 0 || v.skills.length > 0;

  // The file input has no name, so saving the form never re-uploads the resume.
  const importFile = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("resume", file);
    setImported(undefined);
    startImport(async () => {
      const res = await importResume(fd);
      if (!res.profile) return setImported({ kind: "error", text: res.error ?? "Couldn't read that resume." });
      const found = res.profile;
      setV((prev) => mergeImportedProfile(prev, found));
      setImported({ kind: "success", text: `Filled in from your resume: ${found.roles.length} roles and ${found.skills.length} skills. Check everything, then ${onboarding ? "continue" : "save"}.` });
    });
  };

  const applyWish = () => {
    const p = parseSearchProfile(wish);
    setV((prev) => ({ ...prev, ...p, roles: p.roles ?? prev.roles, skills: p.skills ?? prev.skills, locations: p.locations ?? prev.locations, preferences: p.preferences ?? prev.preferences }));
  };

  return (
    <form action={formAction} className="space-y-6" onKeyDown={(e) => { if (e.key === "Enter" && onboarding && (e.target as HTMLElement).tagName !== "TEXTAREA") e.preventDefault(); }}>
      {onboarding && (
        <div className="mb-8">
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-zinc-900" : "bg-zinc-200"}`} />)}
          </div>
          <p className="mt-2 text-xs font-medium text-zinc-500">Step {step + 1} of {STEPS.length}</p>
        </div>
      )}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}

      <FormSection visible={show(0)} onboarding={onboarding} title={STEPS[0]} hint="Roles and skills drive most of the match score. Add several.">
        {resumeImport && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-4">
            <label className="label" htmlFor="resume">Start from your resume (PDF)</label>
            <input id="resume" type="file" accept="application/pdf" disabled={importing} onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }}
              className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 disabled:opacity-60" />
            <p className="hint" aria-live="polite">{importing ? "Reading your resume… this takes a few seconds." : "We read it to fill in the fields below. The file isn't stored."}</p>
            {imported && <div className="mt-3"><Alert kind={imported.kind}>{imported.text}</Alert></div>}
          </div>
        )}
        {onboarding && (
          <div className="rounded-lg bg-zinc-50 p-4">
            <label className="label" htmlFor="wish">Describe it in one line (optional)</label>
            <div className="flex gap-2">
              <input id="wish" value={wish} onChange={(e) => setWish(e.target.value)} className="input" placeholder="e.g. Remote marketing roles in India, 4+ years, min ₹8 LPA" />
              <button type="button" onClick={applyWish} disabled={!wish.trim()} className="btn-secondary shrink-0">Prefill</button>
            </div>
          </div>
        )}
        <div><label className="label">Desired job titles</label><TagInput name="roles" value={v.roles} onChange={set("roles")} placeholder="Registered Nurse, Accountant, Product Designer…" suggestions={ROLE_SUGGESTIONS} /></div>
        <div><label className="label">Skills</label><TagInput name="skills" value={v.skills} onChange={set("skills")} placeholder="Patient Care, Excel, SEO, Figma…" suggestions={SKILL_SUGGESTIONS} /></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label className="label">Keywords</label><TagInput name="keywords" value={v.keywords} onChange={set("keywords")} placeholder="e.g. startup, remote, part-time" /><p className="hint">Boosts listings that mention these.</p></div>
          <div><label className="label">Industries</label><TagInput name="industries" value={v.industries} onChange={set("industries")} placeholder="Fintech…" suggestions={INDUSTRY_SUGGESTIONS} /></div>
          <div><label className="label">Companies to target</label><TagInput name="companies" value={v.companies} onChange={set("companies")} placeholder="Company names" /></div>
          <div><label className="label">Companies to exclude</label><TagInput name="excluded_companies" value={v.excluded_companies} onChange={set("excluded_companies")} placeholder="Never show these" /></div>
        </div>
        <div><label className="label">Keywords to exclude</label><TagInput name="excluded_keywords" value={v.excluded_keywords} onChange={set("excluded_keywords")} placeholder="e.g. Salesforce, PHP" /></div>
      </FormSection>

      <FormSection visible={show(1)} onboarding={onboarding} title={STEPS[1]}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label className="label" htmlFor="years">Years of experience</label><input id="years" name="years_experience" type="number" min={0} max={50} step={0.5} value={v.years_experience} onChange={(e) => set("years_experience")(parseFloat(e.target.value) || 0)} className="input" /></div>
          <div><label className="label" htmlFor="seniority">Seniority</label>
            <select id="seniority" name="seniority" value={v.seniority} onChange={(e) => set("seniority")(e.target.value)} className="input">
              {SENIORITIES.map((s) => <option key={s} value={s}>{s === "mid" ? "Mid-level" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select></div>
          <div><label className="label" htmlFor="current_role">Current role</label><input id="current_role" name="current_role" value={v.current_role} onChange={(e) => set("current_role")(e.target.value)} className="input" placeholder="Your current job title" /></div>
          <div><label className="label" htmlFor="education">Education</label><input id="education" name="education" value={v.education} onChange={(e) => set("education")(e.target.value)} className="input" placeholder="B.Tech Computer Science" /></div>
        </div>
      </FormSection>

      <FormSection visible={show(2)} onboarding={onboarding} title={STEPS[2]} hint="Add countries or cities. Use “Global” for anywhere.">
        <div><label className="label">Locations</label><TagInput name="locations" value={v.locations} onChange={set("locations")} placeholder="India, Bengaluru, Global…" suggestions={LOCATION_SUGGESTIONS} /></div>
        <div>
          <label className="label">Work arrangement</label>
          <input type="hidden" name="remote_preference" value={JSON.stringify(v.remote_preference)} />
          <div className="grid gap-2 sm:grid-cols-3">
            {[["remote", "Remote"], ["hybrid", "Hybrid"], ["onsite", "On-site"]].map(([k, l]) => (
              <label key={k} className="check-row"><input type="checkbox" checked={v.remote_preference.includes(k)} onChange={() => toggle("remote_preference", k)} />{l}</label>
            ))}
          </div>
        </div>
      </FormSection>

      <FormSection visible={show(3)} onboarding={onboarding} title={STEPS[3]} hint={v.currency === "INR" ? "Enter INR amounts in lakhs (e.g. 20 for ₹20 LPA)." : "Enter amounts in full (e.g. 90000)."}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label className="label" htmlFor="currency">Currency</label>
            <select id="currency" name="currency" value={v.currency} onChange={(e) => set("currency")(e.target.value)} className="input">
              {["INR", "USD", "EUR", "GBP", "SGD", "AED"].map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div><label className="label" htmlFor="period">Frequency</label>
            <select id="period" name="salary_period" value={v.salary_period} onChange={(e) => set("salary_period")(e.target.value)} className="input"><option value="year">Per year</option><option value="month">Per month</option></select></div>
          <div><label className="label" htmlFor="smin">Minimum salary</label><input id="smin" name="salary_min" type="number" min={0} step="any" disabled={unspecified} value={v.salary_min == null ? "" : v.salary_min / scale} onChange={(e) => set("salary_min")(e.target.value === "" ? null : parseFloat(e.target.value) * scale)} className="input disabled:bg-zinc-50" /></div>
          <div><label className="label" htmlFor="smax">Maximum salary <span className="font-normal text-zinc-400">(optional)</span></label><input id="smax" name="salary_max" type="number" min={0} step="any" disabled={unspecified} value={v.salary_max == null ? "" : v.salary_max / scale} onChange={(e) => set("salary_max")(e.target.value === "" ? null : parseFloat(e.target.value) * scale)} className="input disabled:bg-zinc-50" /></div>
        </div>
        <label className="check-row sm:w-fit"><input type="checkbox" name="salary_unspecified" value="1" checked={unspecified} onChange={(e) => setUnspecified(e.target.checked)} />Salary not specified — don&apos;t score on pay</label>
      </FormSection>

      <FormSection visible={show(4)} onboarding={onboarding} title={STEPS[4]}>
        <div>
          <label className="label">Employment type</label>
          <input type="hidden" name="employment_types" value={JSON.stringify(v.employment_types)} />
          <div className="grid gap-2 sm:grid-cols-4">
            {["full-time", "part-time", "contract", "internship"].map((k) => (
              <label key={k} className="check-row"><input type="checkbox" checked={v.employment_types.includes(k)} onChange={() => toggle("employment_types", k)} />{k.charAt(0).toUpperCase() + k.slice(1)}</label>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Additional preferences</label>
          <input type="hidden" name="preferences" value={JSON.stringify(v.preferences)} />
          <div className="grid gap-2 sm:grid-cols-2">
            {[["visa_sponsorship", "Visa sponsorship required"], ["relocation_support", "Relocation support"], ["remote_only", "Remote only"], ["startup", "Startup preference"], ["product_company", "Product company preference"]].map(([k, l]) => (
              <label key={k} className="check-row"><input type="checkbox" checked={v.preferences.includes(k)} onChange={() => toggle("preferences", k)} />{l}</label>
            ))}
          </div>
        </div>
      </FormSection>

      <FormSection visible={show(5)} onboarding={onboarding} title={STEPS[5]} hint="How often should the agent hunt for you?">
        <div className="grid gap-2 sm:grid-cols-3">
          {[["daily", "Daily", "Recommended"], ["twice_daily", "Twice daily", "For active searches"], ["weekly", "Weekly", "Low-key"]].map(([k, l, d]) => (
            <label key={k} className="check-row items-start"><input type="radio" name="search_frequency" value={k} checked={v.search_frequency === k} onChange={() => set("search_frequency")(k)} className="mt-0.5" /><span><span className="block font-medium">{l}</span><span className="text-xs text-zinc-500">{d}</span></span></label>
          ))}
        </div>
        <div className="sm:w-64">
          <label className="label" htmlFor="threshold">Notify me for matches at or above</label>
          <select id="threshold" name="notification_threshold" value={v.notification_threshold} onChange={(e) => set("notification_threshold")(parseInt(e.target.value))} className="input">
            {[70, 75, 80, 85, 90].map((n) => <option key={n} value={n}>{n}% match</option>)}
          </select>
        </div>
        <input type="hidden" name="digest_enabled" value={v.digest_enabled ?? 1} />
      </FormSection>

      <div className="flex items-center justify-between gap-3 pt-2">
        {onboarding ? (
          <>
            <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || pending} className="btn-ghost">Back</button>
            {step < STEPS.length - 1 ? (
              <button key="next" type="button" onClick={(e) => { e.preventDefault(); setStep((s) => s + 1); }} disabled={!canNext} className="btn-primary">Continue</button>
            ) : (
              <button key="submit" type="submit" disabled={pending} className="btn-primary">{pending ? "Starting your first hunt…" : "Start Hunting"}</button>
            )}
          </>
        ) : (
          <>
            <RunSearchButton />
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save Changes"}</button>
          </>
        )}
      </div>
    </form>
  );
}
