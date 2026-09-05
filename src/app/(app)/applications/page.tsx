import { requireUser } from "@/lib/auth";
import { listApplications } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { Board } from "@/components/Board";

export const metadata = { title: "Applications" };

export default async function Applications() {
  const user = await requireUser();
  const apps = listApplications(user.id);
  return (
    <>
      <PageHeader title="Applications" description="Drag cards between stages. Click a card for notes and follow-ups." />
      {apps.length ? <Board apps={apps} /> : (
        <EmptyState title="Your application pipeline is empty." body="Once you apply to an opportunity, track it here." cta="Find Opportunities" href="/opportunities" />
      )}
    </>
  );
}
