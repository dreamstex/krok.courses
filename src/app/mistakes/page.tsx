import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons";

interface MistakesPageProps {
  searchParams?: Promise<{ page?: string }>;
}

export default async function MistakesPage(props: MistakesPageProps) {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect("/login");

  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const requestedPage = parseInt(searchParams?.page ?? "1", 10) || 1;
  const pageSize = 10;

  const totalErrors = await prisma.learningError.count({
    where: { userId: user.id },
  });
  const totalPages = Math.max(1, Math.ceil(totalErrors / pageSize));
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);

  const errors = await prisma.learningError.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    include: {
      task: {
        select: {
          prompt: true,
          skill: { select: { titleBe: true, titleRu: true } },
        },
      },
    },
  });

  return (
    <main className="wrap">
      <h1>{t(locale, "mistakes.title")}</h1>
      <p className="lead">{t(locale, "mistakes.lead")}</p>

      {totalErrors === 0 ? (
        <div className="card">
          <p><strong>{t(locale, "mistakes.none")}</strong></p>
          <p className="muted">{t(locale, "mistakes.noneNote")}</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {errors.map((error) => (
              <div className="card" key={error.id} style={{ marginBottom: 0 }}>
                <p className="kicker">
                  {locale === "ru"
                    ? error.task.skill.titleRu ?? error.task.skill.titleBe
                    : error.task.skill.titleBe}
                </p>
                <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{error.task.prompt}</p>
                <span className="tag tag-mistake">
                  {t(
                    locale,
                    error.category === "wrong-choice"
                      ? "mistakes.wrongChoice"
                      : error.category === "wrong-form"
                        ? "mistakes.wrongForm"
                        : error.category === "not-corrected"
                          ? "mistakes.notCorrected"
                          : error.category === "free-text"
                            ? "mistakes.freeText"
                            : "mistakes.wrongChoice",
                  )}
                </span>
                <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
                  {error.createdAt.toLocaleDateString(locale === "ru" ? "ru-RU" : "be-BY")}
                </p>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="pagination" aria-label="Pagination">
              {currentPage > 1 ? (
                <Link
                  href={`/mistakes?page=${currentPage - 1}`}
                  className="pagination-btn"
                  aria-label={locale === "ru" ? "Предыдущая страница" : "Папярэдняя старонка"}
                >
                  <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6 }} />
                  <span>{locale === "ru" ? "Назад" : "Назад"}</span>
                </Link>
              ) : (
                <span className="pagination-btn disabled" aria-disabled="true">
                  <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6 }} />
                  <span>{locale === "ru" ? "Назад" : "Назад"}</span>
                </span>
              )}

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                if (
                  totalPages > 7 &&
                  p !== 1 &&
                  p !== totalPages &&
                  Math.abs(p - currentPage) > 2
                ) {
                  if (p === 2 || p === totalPages - 1) {
                    return (
                      <span key={p} className="muted" style={{ padding: "0 4px" }}>
                        …
                      </span>
                    );
                  }
                  return null;
                }

                const isCurrent = p === currentPage;
                if (isCurrent) {
                  return (
                    <span key={p} className="pagination-btn active" aria-current="page">
                      {p}
                    </span>
                  );
                }
                return (
                  <Link key={p} href={`/mistakes?page=${p}`} className="pagination-btn">
                    {p}
                  </Link>
                );
              })}

              {currentPage < totalPages ? (
                <Link
                  href={`/mistakes?page=${currentPage + 1}`}
                  className="pagination-btn"
                  aria-label={locale === "ru" ? "Следующая страница" : "Наступная старонка"}
                >
                  <span>{locale === "ru" ? "Вперед" : "Наперад"}</span>
                  <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                </Link>
              ) : (
                <span className="pagination-btn disabled" aria-disabled="true">
                  <span>{locale === "ru" ? "Вперед" : "Наперад"}</span>
                  <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
