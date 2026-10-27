"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCircleExclamation,
  faArrowRight,
  faCircleQuestion,
} from "@fortawesome/free-solid-svg-icons";

const SKIP_VALUE = "__SKIP__";

interface DiagnosticTask {
  id: string;
  skillId: string;
  skillTitleBe: string;
  skillTitleRu: string;
  moduleTitleBe: string;
  moduleTitleRu: string;
  type: "choice" | "fill" | "correction" | "free-text";
  prompt: string;
  options: string[];
}

interface DiagnosticSkillSummary {
  skillId: string;
  titleBe: string;
  titleRu: string;
  moduleTitleBe: string;
  moduleTitleRu: string;
}

interface DiagnosticSummaryResult {
  alreadyDone: boolean;
  total: number;
  correct: number;
  weakSkills: DiagnosticSkillSummary[];
  strongSkills: DiagnosticSkillSummary[];
}

export function DiagnosticForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const isRu = locale === "ru";
  const [tasks, setTasks] = useState<DiagnosticTask[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<DiagnosticSummaryResult | null>(null);

  useEffect(() => {
    fetch("/api/diagnostic")
      .then((response) => response.json())
      .then((data: { tasks: DiagnosticTask[] }) => setTasks(data.tasks ?? []))
      .catch(() => setLoadError(t(locale, "diagnostic.loadError")));
  }, [locale]);

  function setAnswer(taskId: string, value: string) {
    setAnswers((current) => ({ ...current, [taskId]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setPending(true);
    try {
      const response = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitError(data.error ?? t(locale, "diagnostic.saveError"));
        return;
      }
      if (data.summary) {
        setSummary(data.summary as DiagnosticSummaryResult);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setSubmitError(t(locale, "common.noConnection"));
    } finally {
      setPending(false);
    }
  }

  if (loadError) return <p className="error" role="alert">{loadError}</p>;
  if (!tasks) return <p className="muted">{t(locale, "diagnostic.loading")}</p>;

  if (summary) {
    const percent = summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0;
    return (
      <section className="card" style={{ maxWidth: 680 }}>
        <p className="kicker">
          {isRu ? "Результаты начальной оценки" : "Вынікі пачатковай ацэнкі"}
        </p>
        <h2 style={{ marginTop: 4 }}>
          {isRu
            ? `Верно: ${summary.correct} из ${summary.total} (${percent}%)`
            : `Дакладна: ${summary.correct} з ${summary.total} (${percent}%)`}
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {isRu
            ? "Крок проанализировал ваши ответы по всем модулям и сформировал персональный план практики. В разделе «Практика» вам в первую очередь будут предложены темы, где были ошибки или пропуски."
            : "Крок прааналізаваў вашы адказы па ўсіх модулях і сфарміраваў персанальны план практыкі. У раздзеле «Практыка» вам у першую чаргу будуць прапанаваны тэмы, дзе былі памылкі альбо пропускі."}
        </p>

        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px" }}>
            <FontAwesomeIcon icon={faCircleExclamation} style={{ color: "#d97706" }} />
            <span>
              {isRu
                ? `Слабые места – приоритет для практики (${summary.weakSkills.length})`
                : `Слабыя месцы – прыярытэт для практыкі (${summary.weakSkills.length})`}
            </span>
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {summary.weakSkills.map((s) => (
              <div
                key={s.skillId}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {isRu ? s.titleRu : s.titleBe}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {isRu ? s.moduleTitleRu : s.moduleTitleBe}
                  </div>
                </div>
                <span className="tag tag-mistake" style={{ fontSize: 12 }}>
                  {isRu ? "Нужна практика" : "Патрэбна практыка"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {summary.strongSkills.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px" }}>
              <FontAwesomeIcon icon={faCheck} style={{ color: "var(--accent)" }} />
              <span>
                {isRu
                  ? `Уверенные темы (${summary.strongSkills.length})`
                  : `Упэўненыя тэмы (${summary.strongSkills.length})`}
              </span>
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {summary.strongSkills.map((s) => (
                <span
                  key={s.skillId}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent)",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {isRu ? s.titleRu : s.titleBe}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
          <Link href="/practice" className="btn" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span>{isRu ? "Начать практику по слабым темам" : "Пачаць практыку па слабых тэмах"}</span>
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
          <Link href="/dashboard" className="btn secondary">
            {isRu ? "На главную" : "На галоўную"}
          </Link>
        </div>
      </section>
    );
  }

  const answeredCount = tasks.filter((tItem) => Boolean(answers[tItem.id])).length;

  return (
    <form onSubmit={handleSubmit}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {isRu
              ? `Отвечено: ${answeredCount} из ${tasks.length}`
              : `Адказана: ${answeredCount} з ${tasks.length}`}
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            {isRu
              ? "Если не уверены − выбирайте «Не знаю», чтобы сразу добавить тему в практику"
              : "Калі не ўпэўненыя − выбірайце «Не ведаю», каб адразу дадаць тэму ў практыку"}
          </span>
        </div>
        <div className="bar">
          <span style={{ width: `${tasks.length > 0 ? Math.round((answeredCount / tasks.length) * 100) : 0}%` }} />
        </div>
      </div>

      {tasks.map((task, index) => {
        const currentVal = answers[task.id] ?? "";
        const isSkipped = currentVal === SKIP_VALUE;
        return (
          <div className="card" key={task.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <p className="kicker" style={{ margin: 0 }}>
                {t(locale, "diagnostic.question", { n: index + 1, total: tasks.length })}
              </p>
              <span className="muted" style={{ fontSize: 12 }}>
                {isRu ? task.skillTitleRu : task.skillTitleBe}
              </span>
            </div>
            <p style={{ fontWeight: 600, margin: "0 0 12px", fontSize: 16 }}>{task.prompt}</p>
            {task.options.length > 0 ? (
              <div className="options">
                {task.options.map((option) => (
                  <label className="option" key={option}>
                    <input
                      type="radio"
                      name={task.id}
                      value={option}
                      checked={currentVal === option}
                      onChange={() => setAnswer(task.id, option)}
                    />
                    {option}
                  </label>
                ))}
                <label className="option" style={{ opacity: 0.85, borderStyle: "dashed" }}>
                  <input
                    type="radio"
                    name={task.id}
                    value={SKIP_VALUE}
                    checked={isSkipped}
                    onChange={() => setAnswer(task.id, SKIP_VALUE)}
                  />
                  <FontAwesomeIcon icon={faCircleQuestion} style={{ opacity: 0.7 }} />
                  {isRu ? "Не знаю / разобрать эту тему в Практике" : "Не ведаю / разабраць гэтую тэму ў Практыцы"}
                </label>
              </div>
            ) : (
              <div className="field">
                <label htmlFor={task.id}>{t(locale, "diagnostic.answer")}</label>
                <input
                  id={task.id}
                  type="text"
                  value={isSkipped ? "" : currentVal}
                  onChange={(event) => setAnswer(task.id, event.target.value)}
                  maxLength={200}
                />
              </div>
            )}
          </div>
        );
      })}
      {submitError && <p className="error" role="alert">{submitError}</p>}
      <button className="btn" type="submit" disabled={pending} style={{ width: "100%", padding: "12px 18px", fontSize: 16 }}>
        {pending ? t(locale, "diagnostic.saving") : t(locale, "diagnostic.submit")}
      </button>
    </form>
  );
}
