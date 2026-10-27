import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { LogoutButton } from "@/components/logout-button";
import { prisma } from "@/lib/db/prisma";
import { loadSkillProgress, getUserGameLevel } from "@/lib/learning/skill-state";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { Footer } from "@/components/footer";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect("/login");

  const [progress, attempts] = await Promise.all([
    loadSkillProgress(user.id),
    prisma.taskAttempt.findMany({
      where: { userId: user.id },
      select: { isCorrect: true, evaluated: true },
    }),
  ]);
  const judged = attempts.filter((attempt) => attempt.evaluated);
  const correct = judged.filter((attempt) => attempt.isCorrect).length;
  const accuracy = judged.length ? Math.round((correct / judged.length) * 100) : null;
  const gameLevel = getUserGameLevel(correct);
  const levelTitle = locale === "ru" ? gameLevel.titleRu : gameLevel.titleBe;
  const practised = progress
    .filter((skill) => (skill.practiceAttempts ?? 0) > 0 || (skill.solvedTasks ?? 0) > 0)
    .sort((a, b) => (b.solvedTasks ?? 0) - (a.solvedTasks ?? 0) || b.mastery - a.mastery);

  return (
    <main className="wrap">
      <h1 style={{ margin: "0px 0px 1.8rem" }}>{t(locale, "profile.title")}</h1>

      <section className="card profile-header">
        <div className="profile-avatar profile-header-avatar">
          {user.avatarData
            ? <Image src={user.avatarData} alt={t(locale, "profile.avatarAlt")} width={112} height={112} unoptimized />
            : <span>{user.displayName.trim().charAt(0).toUpperCase()}</span>}
        </div>
        <div className="profile-header-info">
          <h2>{user.displayName}</h2>
          <p className="muted">{user.email}</p>
        </div>
        <div className="profile-header-actions">
          <Link className="btn secondary" href="/profile/edit">{t(locale, "profile.edit")}</Link>
          <LogoutButton locale={locale} compact={false} />
        </div>
      </section>

      <section className="profile-progress">
        <h2>{t(locale, "progress.title")}</h2>
        <div className="stat-row">
          <section className="card stat">
            <p className="kicker">{t(locale, "progress.total")}</p>
            <p className="big-number" style={{ fontSize: 28 }}>{attempts.length}</p>
          </section>
          <section className="card stat">
            <p className="kicker">{t(locale, "progress.accuracy")}</p>
            <p className="big-number" style={{ fontSize: 28 }}>{accuracy === null ? "—" : `${accuracy}%`}</p>
          </section>
          <section className="card stat">
            <p className="kicker">{t(locale, "progress.level")}</p>
            <p className="big-number" style={{ fontSize: 24, margin: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <FontAwesomeIcon icon={faStar} style={{ color: "#eab308" }} />
              <span>{levelTitle} ({gameLevel.level} ур.)</span>
            </p>
            <div className="bar" style={{ height: 6, margin: "8px 0" }}>
              <span style={{ width: `${gameLevel.progressPercent}%` }} />
            </div>
          </section>
        </div>

        <h2>{t(locale, "progress.skills")}</h2>
        {practised.length === 0 ? (
          <p className="muted">{t(locale, "progress.noPractice")}</p>
        ) : (
          <section className="card">
            {practised.map((skill) => {
              const solved = skill.solvedTasks ?? 0;
              const total = skill.totalTasks ?? 6;
              const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
              return (
                <div key={skill.skillId} className="profile-skill-row">
                  <div className="profile-skill-label">
                    <span>{locale === "ru" ? skill.titleRu ?? skill.titleBe : skill.titleBe}</span>
                    <span className="muted">{solved}/{total} ({pct}%)</span>
                  </div>
                  <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </section>
        )}
      </section>

      <Footer locale={locale} style={{ marginTop: 48 }} />
    </main>
  );
}
