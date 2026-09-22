import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TailorTool } from "@/components/TailorTool";

export const metadata = { title: "Tailor Résumé" };

export default async function TailorPage() {
  await requireUser();
  return (
    <>
      <PageHeader
        title="Tailor your résumé"
        description="Paste your résumé and a job description. Get an honest fit score, the gaps to close, and a résumé rewritten for that exact role — free with your account."
      />
      <TailorTool />
    </>
  );
}
