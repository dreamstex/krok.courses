import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/db/prisma";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBullseye,
  faTrophy,
  faCheck,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";

export default async function GoalsPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect("/login");

  const plans = await prisma.learningPlan.findMany({
    where: { userId: user.id },
    include: {
      skills: {
        include: {
          tasks: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const nonEmptyPlans = plans.filter(
      (p) => p.skills.reduce((acc, s) => acc + s.tasks.length, 0) > 0,
  );
  const activeGoals = nonEmptyPlans.filter((p) => p.status === "active");
  const completedGoals = nonEmptyPlans.filter((p) => p.status === "completed");


  return (
    <main className="wrap">
      <p className="kicker">KROK</p>
      <h1>{t(locale, "goals.title")}</h1>
      <p className="lead">{t(locale, "goals.lead")}</p>

      <section className="krokki-banner">
        <div className="krokki-banner-content">
          <div className="krokki-banner-avatar">
            <Image src="/krokki.svg" alt="Кроккі" width={56} height={56} priority />
          </div>
          <div className="krokki-banner-text">
            <h2>{t(locale, "krokki.ctaTitle")}</h2>
            <p className="muted">
              {t(locale, "krokki.ctaDesc")}
            </p>
          </div>
        </div>
        <Link href="/chat" className="btn krokki-banner-btn">
          {t(locale, "krokki.ctaButton")}
        </Link>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2>{t(locale, "goals.active")} ({activeGoals.length})</h2>
        {activeGoals.length === 0 ? (
          <p className="muted">{t(locale, "goals.noActive")}</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {activeGoals.map((goal) => {
              const taskCount = goal.skills.reduce((acc, s) => acc + s.tasks.length, 0);
              const title = locale === "ru" && goal.titleRu ? goal.titleRu : goal.title;
              const summary = locale === "ru" && goal.summaryRu ? goal.summaryRu : goal.summary;

              return (
                <div key={goal.id} className="card goal-card">
                  <div className="goal-card-info">
                    <h3 style={{ margin: "0 0 4px", fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
                      <FontAwesomeIcon icon={faBullseye} style={{ color: "var(--accent)" }} />
                      {title}
                    </h3>
                    <p className="muted" style={{ margin: "0 0 6px", fontSize: 14 }}>{summary}</p>
                    <span className="caption-note">{t(locale, "goals.tasksCount", { n: taskCount })}</span>
                  </div>
                  <Link href={`/goals/${goal.id}`} className="btn goal-card-btn">
                    {t(locale, "goals.solve")}
                    <FontAwesomeIcon icon={faArrowRight} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2>{t(locale, "goals.completed")} ({completedGoals.length})</h2>
        {completedGoals.length === 0 ? (
          <p className="muted">{t(locale, "goals.noCompleted")}</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {completedGoals.map((goal) => {
              const taskCount = goal.skills.reduce((acc, s) => acc + s.tasks.length, 0);
              const title = locale === "ru" && goal.titleRu ? goal.titleRu : goal.title;

              return (
                <div key={goal.id} className="card goal-card" style={{ opacity: 0.9 }}>
                  <div className="goal-card-info">
                    <h3 style={{ margin: "0 0 4px", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <FontAwesomeIcon icon={faTrophy} style={{ color: "var(--accent)" }} />
                      {title}
                    </h3>
                    <span className="caption-note" style={{ color: "var(--accent)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <FontAwesomeIcon icon={faCheck} />
                      {goal.score !== null && goal.score !== undefined ? (
                        <span>
                          {t(locale, "goals.completedBadge")} · {goal.score} / {goal.maxScore ?? taskCount} ({Math.round((goal.score / (goal.maxScore ?? taskCount)) * 100)}%)
                        </span>
                      ) : (
                        <span>
                          {t(locale, "goals.completedBadge")} ({t(locale, "goals.tasksCount", { n: taskCount })})
                        </span>
                      )}
                    </span>
                  </div>
                  <Link href={`/goals/${goal.id}`} className="btn secondary goal-card-btn" style={{ fontSize: 13 }}>
                    {t(locale, "goals.retake")}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
