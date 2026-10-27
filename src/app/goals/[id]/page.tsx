import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/db/prisma";
import { GoalTrainer } from "@/components/goal-trainer";
import { toTaskView } from "@/lib/learning/task-view";

export default async function GoalPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ skipTheory?: string }>;
}) {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect("/login");

  const { id } = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const skipTheory = searchParams.skipTheory === "1";

  const plan = await prisma.learningPlan.findFirst({
    where: { id, userId: user.id },
    include: {
      skills: {
        include: {
          tasks: { where: { active: true }, orderBy: { id: "asc" } },
        },
      },
    },
  });

  if (!plan) notFound();

  const allTasks = plan.skills.flatMap((s) => s.tasks).map(toTaskView);

  const contentObj =
    plan.content && typeof plan.content === "object" && !Array.isArray(plan.content)
      ? (plan.content as Record<string, unknown>)
      : {};
  const rawTheoryBe =
    typeof contentObj.theoryBe === "string"
      ? contentObj.theoryBe
      : plan.skills[0]?.descriptionBe ?? plan.summary;
  const rawTheoryRu =
    typeof contentObj.theoryRu === "string"
      ? contentObj.theoryRu
      : plan.skills[0]?.descriptionRu ?? plan.summaryRu ?? plan.summary;

  const theory = locale === "ru" ? rawTheoryRu : rawTheoryBe;

  return (
    <main className="wrap">
      <GoalTrainer
        goalId={plan.id}
        chatSessionId={plan.chatSessionId}
        initialScore={plan.score}
        initialMaxScore={plan.maxScore}
        title={locale === "ru" && plan.titleRu ? plan.titleRu : plan.title}
        summary={locale === "ru" && plan.summaryRu ? plan.summaryRu : plan.summary}
        theory={theory}
        initialSkipTheory={skipTheory}
        status={plan.status}
        tasks={allTasks}
        locale={locale}
      />
    </main>
  );
}
