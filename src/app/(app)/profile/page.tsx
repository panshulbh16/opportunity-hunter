import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { EMPTY_PROFILE, ProfileForm, type ProfileValues } from "@/components/ProfileForm";

export const metadata = { title: "Search Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const p = getProfile(user.id);
  const initial: ProfileValues = p ? {
    roles: p.roles, skills: p.skills, keywords: p.keywords, industries: p.industries, companies: p.companies,
    excluded_companies: p.excluded_companies, excluded_keywords: p.excluded_keywords, years_experience: p.years_experience,
    current_role: p.current_role, education: p.education, seniority: p.seniority, locations: p.locations,
    remote_preference: p.remote_preference, salary_min: p.salary_min, salary_max: p.salary_max, currency: p.currency,
    salary_period: p.salary_period, employment_types: p.employment_types, preferences: p.preferences,
    notification_threshold: p.notification_threshold, search_frequency: p.search_frequency, digest_enabled: p.digest_enabled,
  } : EMPTY_PROFILE;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Search Profile" description="This is what the agent hunts for. Changes apply on the next run." />
      <ProfileForm initial={initial} mode="edit" />
    </div>
  );
}
