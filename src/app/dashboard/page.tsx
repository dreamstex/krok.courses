import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/session";
import { getNextTask } from "@/lib/learning/next-task";
import { loadSkillProgress, getUserGameLevel } from "@/lib/learning/skill-state";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faArrowRight } from "@fortawesome/free-solid-svg-icons";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  const isRu = locale === "ru";
  if (!user) redirect("/login");
  if (!user.preferences?.onboardedAt) redirect("/onboarding");
  if (!user.preferences?.diagnosedAt) redirect("/diagnostic");

  const today = new Date();
  // чтобы день считался по минску а не по utc сервера версела, который по нулю 
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(today);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const dayStart = new Date(`${year}-${month}-${day}T00:00:00+03:00`);


  const [next, progress, attempts, correctAttempts, todayAttempts, plan, activeGoalsCount] = await Promise.all([
    getNextTask(user.id, new Date(), locale),
    loadSkillProgress(user.id),
    prisma.taskAttempt.count({ where: { userId: user.id } }),
    prisma.taskAttempt.count({ where: { userId: user.id, isCorrect: true } }),
    prisma.taskAttempt.count({ where: { userId: user.id, createdAt: { gte: dayStart } } }),
    prisma.learningPlan.findFirst({
      where: { userId: user.id, status: "active", skills: { some: {} } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.learningPlan.count({
      where: { userId: user.id, status: "active", skills: { some: {} } },
    }),
  ]);

  const gameLevel = getUserGameLevel(correctAttempts);
  const levelTitle = isRu ? gameLevel.titleRu : gameLevel.titleBe;
  const weakest = [...progress]
      .filter((s) => (s.errorCount > 0 || (s.attempts > 0 && s.mastery < 0.65)) && (s.solvedTasks ?? 0) < (s.totalTasks ?? 6))
      .sort((a, b) => (a.solvedTasks ?? 0) - (b.solvedTasks ?? 0) || a.mastery - b.mastery)
      .slice(0, 5);
  const dailyMinutes = plan?.dailyMinutes ?? user.preferences?.minutesPerDay ?? 10;
  const dailyTaskTarget = Math.max(1, Math.ceil(dailyMinutes / 5));
  const dailyProgress = Math.min(todayAttempts, dailyTaskTarget);
  const planTitle = isRu
    ? plan?.titleRu ?? t(locale, "dashboard.title")
    : plan?.title ?? t(locale, "dashboard.title");
  const planSummary = isRu ? plan?.summaryRu : plan?.summary;

  return (
    <main className="wrap">
      <p className="kicker">{t(locale, "dashboard.welcome", { name: user.displayName })}</p>
      <h1>{planTitle}</h1>
      {planSummary && <p className="lead">{planSummary}</p>}

      <section className="card hero" aria-labelledby="next-step">
        <p className="kicker">{t(locale, "dashboard.today", { n: dailyMinutes })}</p>
        <p className="muted">{t(locale, "dashboard.goal", { n: dailyTaskTarget })}</p>
        <div className="bar" aria-label={t(locale, "dashboard.done", { done: dailyProgress, total: dailyTaskTarget })}>
          <span style={{ width: `${Math.round((dailyProgress / dailyTaskTarget) * 100)}%` }} />
        </div>
        <p className="caption-note">{t(locale, "dashboard.done", { done: dailyProgress, total: dailyTaskTarget })}</p>
        {next ? (
          <>
            <p className="kicker" id="next-step">{t(locale, "dashboard.next")}</p>
            <span className="muted" style={{ fontSize: 13 }}>{next.moduleTitle}</span>
            <h2 style={{ margin: "4px 0 8px" }}>{next.skillTitle}</h2>
            <p className="muted" style={{ margin: "0 0 14px" }}>
              <strong>{t(locale, "dashboard.why")}</strong> {next.reason}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href={`/practice?skillId=${encodeURIComponent(next.skillId)}`} className="btn">
                {t(locale, "dashboard.start")}
              </Link>
              <Link
                href={`/chat?topicSkillId=${encodeURIComponent(next.skillId)}&returnTo=${encodeURIComponent(`/practice?skillId=${next.skillId}&skipTheory=1`)}`}
                className="btn secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Image src="/krokki.svg" alt="" width={18} height={18} className="krokki-btn-icon" />
                <span>{isRu ? "Обсудить теорию с Крокки" : "Абмеркаваць тэорыю з Кроккі"}</span>
              </Link>
            </div>
          </>
        ) : (
          <p>{t(locale, "dashboard.noTask")}</p>
        )}
      </section>

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

      <div className="stat-row">
        <section className="card stat">
          <p className="kicker">{t(locale, "dashboard.level")}</p>
          <p className="big-number" style={{ fontSize: 26, margin: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <FontAwesomeIcon icon={faStar} style={{ color: "#eab308" }} />
            <span>{levelTitle} ({gameLevel.level} {isRu ? "ур." : "узр."})</span>
          </p>
          <div className="bar" style={{ height: 6, margin: "8px 0" }}>
            <span style={{ width: `${gameLevel.progressPercent}%` }} />
          </div>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {t(locale, "game.nextLevel", {
              next: gameLevel.level + 1,
              rem: Math.max(0, gameLevel.nextLevelMin - gameLevel.correctAnswers),
            })}
          </p>
        </section>

        <section className="card stat">
          <p className="kicker">{t(locale, "dashboard.completed")}</p>
          <p className="big-number" style={{ fontSize: 28 }}>{attempts}</p>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {isRu ? `Верных ответов: ${correctAttempts}` : `Дакладных адказаў: ${correctAttempts}`}
          </p>
        </section>
      </div>

      {activeGoalsCount > 0 && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="kicker" style={{ margin: 0 }}>{t(locale, "goals.title")}</p>
              <h3 style={{ margin: "4px 0" }}>
                {isRu
                  ? `Активных целей и тестов: ${activeGoalsCount}`
                  : `Актыўных мэт і тэстаў: ${activeGoalsCount}`}
              </h3>
            </div>
            <Link href="/goals" className="btn secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {t(locale, "goals.active")}
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </div>
        </section>
      )}

      <section className="card">
        <p className="kicker">{t(locale, "dashboard.weakSkills")}</p>
        {weakest.length === 0 ? (
          <p className="muted">{t(locale, "dashboard.noPractice")}</p>
        ) : (
          weakest.map((skill) => {
            const solved = skill.solvedTasks ?? 0;
            const total = skill.totalTasks ?? 6;
            const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
            return (
              <div key={skill.skillId} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Link
                    href={`/practice?skillId=${encodeURIComponent(skill.skillId)}`}
                    style={{ fontWeight: 500, textDecoration: "none", color: "var(--text)" }}
                  >
                    {isRu ? skill.titleRu ?? skill.titleBe : skill.titleBe}
                  </Link>
                  <span className="muted">{solved}/{total} · {pct}%</span>
                </div>
                <div className="bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
