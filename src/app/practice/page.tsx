import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getNextTask, getRankedSkills } from "@/lib/learning/next-task";
import { PracticeCard } from "@/components/practice-card";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function PracticePage(props: {
  searchParams?: Promise<{ skillId?: string; skipTheory?: string }>;
}) {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect("/login");
  if (!user.preferences?.diagnosedAt) redirect("/diagnostic");

  const searchParams = props.searchParams ? await props.searchParams : {};
  const requestedSkillId = searchParams.skillId ?? null;
  const skipTheory = searchParams.skipTheory === "1";

  const [next, rankedSkills] = await Promise.all([
    getNextTask(user.id, new Date(), locale, requestedSkillId),
    getRankedSkills(user.id, new Date(), locale),
  ]);

  return (
    <main className="wrap">
      <h1>{t(locale, "practice.title")}</h1>
      <p className="lead">{t(locale, "practice.lead")}</p>
      <PracticeCard
        initialNext={next}
        rankedSkills={rankedSkills}
        initialSkipTheory={skipTheory}
        locale={locale}
      />
    </main>
  );
}
