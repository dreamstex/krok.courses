"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  clearPendingSubmission,
  loadPendingSubmission,
  savePendingSubmission,
  type PendingSubmission,
} from "@/lib/learning/pending-submission";
import { t, type Locale } from "@/lib/i18n";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faArrowRight,
  faCircleExclamation,
  faCheck,
  faXmark,
  faLayerGroup,
  faTrophy,
} from "@fortawesome/free-solid-svg-icons";

interface NextStep {
  task: {
    id: string;
    type: "choice" | "fill" | "correction" | "free-text";
    prompt: string;
    options: string[];
  };
  skillId: string;
  skillTitle: string;
  moduleTitle: string;
  theory: string;
  totalTasksInSkill: number;
  solvedTasksInSkill: number;
  mastery: number;
  topicCompleted: boolean;
  score: number;
  reason: string;
}

interface RankedSkillItem {
  skillId: string;
  titleBe: string;
  moduleTitle: string;
  theory: string;
  mastery: number;
  attempts: number;
  practiceAttempts?: number;
  solvedTasks?: number;
  totalTasks?: number;
  errorCount: number;
  order: number;
  score: number;
  reason: string;
}

interface SkillProgressPayload {
  skillId: string;
  mastery: number;
  solvedTasksInSkill: number;
  totalTasksInSkill: number;
  topicCompleted: boolean;
}

interface AttemptResult {
  isCorrect: boolean | null;
  explanation: string | null;
  evaluated?: boolean;
  skillProgress?: SkillProgressPayload | null;
}

export function PracticeCard({
  initialNext,
  rankedSkills = [],
  initialSkipTheory = false,
  locale,
}: {
  initialNext: NextStep | null;
  rankedSkills?: RankedSkillItem[];
  initialSkipTheory?: boolean;
  locale: Locale;
}) {
  const isRu = locale === "ru";
  const [next, setNext] = useState<NextStep | null>(initialNext);
  const [skillsList, setSkillsList] = useState<RankedSkillItem[]>(rankedSkills);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(initialNext?.skillId ?? null);
  const [showTheoryStep, setShowTheoryStep] = useState<boolean>(
    !initialSkipTheory && Boolean(initialNext?.theory),
  );
  const [seenTheorySkills, setSeenTheorySkills] = useState<string[]>(
    initialSkipTheory && initialNext ? [initialNext.skillId] : [],
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restoredNote, setRestoredNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const postAttempt = useCallback(
    async (
      submission: PendingSubmission,
    ): Promise<{ ok: true; result: AttemptResult } | { ok: false; error: string }> => {
      savePendingSubmission(submission);
      try {
        const response = await fetch("/api/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submission),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) clearPendingSubmission();
          return { ok: false, error: data.error ?? t(locale, "practice.submitError") };
        }
        clearPendingSubmission();
        return { ok: true, result: data as AttemptResult };
      } catch {
        return { ok: false, error: t(locale, "common.noConnection") };
      }
    },
    [locale],
  );

  useEffect(() => {
    const saved = loadPendingSubmission();
    if (!saved) return;
    postAttempt(saved).then((outcome) => {
      if (outcome.ok) setRestoredNote(t(locale, "practice.previousSaved"));
      else setSubmitError(outcome.error);
    });
  }, [locale, postAttempt]);

  async function loadNext(targetSkillId?: string | null, forceTheory = false) {
    setLoadError(null);
    try {
      const query = targetSkillId ? `?skillId=${encodeURIComponent(targetSkillId)}` : "";
      const response = await fetch(`/api/next-task${query}`);
      if (!response.ok) throw new Error("load");
      const data: { next: NextStep | null; rankedSkills?: RankedSkillItem[] } = await response.json();
      clearPendingSubmission();
      setNext(data.next);
      if (data.rankedSkills) {
        setSkillsList(data.rankedSkills);
      }
      setSubmissionId(crypto.randomUUID());
      setResult(null);
      setAnswer("");

      if (data.next) {
        setSelectedSkillId(targetSkillId ?? data.next.skillId);
        const alreadySawTheory = seenTheorySkills.includes(data.next.skillId);
        if (forceTheory || (!alreadySawTheory && data.next.theory)) {
          setShowTheoryStep(true);
        } else {
          setShowTheoryStep(false);
        }
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setLoadError(t(locale, "practice.loadError"));
    }
  }

  function handleStartTasksFromTheory() {
    if (next && !seenTheorySkills.includes(next.skillId)) {
      setSeenTheorySkills((prev) => [...prev, next.skillId]);
    }
    setShowTheoryStep(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!next) return;
    setSubmitError(null);
    setPending(true);
    const outcome = await postAttempt({
      submissionId,
      taskId: next.task.id,
      answer,
      usedHint: "0",
    });
    setPending(false);
    if (outcome.ok) {
      setResult(outcome.result);
      const sp = outcome.result.skillProgress;
      if (sp) {
        setNext((prev) =>
          prev && prev.skillId === sp.skillId
            ? {
                ...prev,
                mastery: sp.mastery,
                solvedTasksInSkill: sp.solvedTasksInSkill,
                totalTasksInSkill: sp.totalTasksInSkill,
                topicCompleted: sp.topicCompleted,
              }
            : prev,
        );
        setSkillsList((prev) =>
          prev.map((item) =>
            item.skillId === sp.skillId
              ? {
                  ...item,
                  mastery: sp.mastery,
                  solvedTasks: sp.solvedTasksInSkill,
                  totalTasks: sp.totalTasksInSkill,
                  practiceAttempts: (item.practiceAttempts ?? 0) + 1,
                  attempts: item.attempts + 1,
                  errorCount: outcome.result.isCorrect === false ? item.errorCount + 1 : item.errorCount,
                }
              : item,
          ),
        );
      }
    } else {
      setSubmitError(outcome.error);
    }
  }

  if (!next) return <p className="muted">{t(locale, "practice.noTask")}</p>;

  const isChoice = next.task.type === "choice";
  const isFreeText = next.task.type === "free-text";
  const discussTheoryUrl = `/chat?topicSkillId=${encodeURIComponent(next.skillId)}&returnTo=${encodeURIComponent(`/practice?skillId=${next.skillId}&skipTheory=1`)}`;
  const solvedCount = next.solvedTasksInSkill ?? 0;
  const totalCount = next.totalTasksInSkill ?? 0;
  const masteryPct = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;
  const isTopicCompleted = Boolean(next.topicCompleted) || (totalCount > 0 && solvedCount >= totalCount);

  const modulesMap = new Map<string, RankedSkillItem[]>();
  for (const s of skillsList) {
    const mod = s.moduleTitle || "Модуль";
    const list = modulesMap.get(mod) ?? [];
    list.push(s);
    modulesMap.set(mod, list);
  }

  const weakTopics = skillsList.filter(
    (s) =>
      (s.errorCount > 0 || (s.attempts > 0 && s.mastery < 0.65)) &&
      (s.solvedTasks ?? 0) < (s.totalTasks ?? 6),
  );

  return (
    <div>
      {showTheoryStep && next.theory ? (
        <section className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p className="kicker" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FontAwesomeIcon icon={faBookOpen} />
              <span>{isRu ? "Шаг 1. Подготовленная теория по теме" : "Крок 1. Падрыхтаваная тэорыя па тэме"}</span>
            </p>
            <span className="muted" style={{ fontSize: 13 }}>
              {next.moduleTitle}
            </span>
          </div>

          <h2 style={{ margin: "8px 0 4px" }}>{next.skillTitle}</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 0, marginBottom: 14 }}>
            {next.reason}
          </p>

          <div
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              background: "var(--bg-subtle)",
              border: "1px solid var(--line)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
              fontSize: 15,
              marginBottom: 20,
            }}
          >
            {next.theory}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              className="btn"
              type="button"
              onClick={handleStartTasksFromTheory}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <span>{isRu ? "Перейти к заданиям по теме" : "Перайсці да заданняў па тэме"}</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>

            <Link
              href={discussTheoryUrl}
              className="btn secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Image src="/krokki.svg" alt="" width={18} height={18} className="krokki-btn-icon" />
              <span>{isRu ? "Обсудить теорию с Крокки" : "Абмеркаваць тэорыю з Кроккі"}</span>
            </Link>
          </div>
        </section>
      ) : (
        <section className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <div>
              <span className="muted" style={{ fontSize: 12, display: "block" }}>
                {next.moduleTitle}
              </span>
              <p className="kicker" style={{ margin: 0 }}>{next.skillTitle}</p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {next.theory && (
                <button
                  type="button"
                  onClick={() => setShowTheoryStep(true)}
                  className="btn secondary"
                  style={{ padding: "6px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <FontAwesomeIcon icon={faBookOpen} />
                  <span>{isRu ? "Теория по теме" : "Тэорыя па тэме"}</span>
                </button>
              )}
              <Link
                href={discussTheoryUrl}
                className="btn secondary"
                style={{ padding: "6px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Image src="/krokki.svg" alt="" width={18} height={18} className="krokki-btn-icon" />
                <span>{isRu ? "Спросить Крокки" : "Спытаць Кроккі"}</span>
              </Link>
            </div>
          </div>

          <p className="muted" style={{ fontSize: 14, marginTop: 0, marginBottom: 10 }}>{next.reason}</p>

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              <span className="muted">
                {isRu
                  ? `Прогресс темы: ${solvedCount} из ${totalCount} заданий`
                  : `Прагрэс тэмы: ${solvedCount} з ${totalCount} заданняў`}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: isTopicCompleted ? "var(--accent)" : "var(--text)",
                }}
              >
                {masteryPct}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: "var(--line)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, masteryPct))}%`,
                  height: "100%",
                  background: "var(--accent)",
                  transition: "width 0.25s ease",
                }}
              />
            </div>
          </div>

          <p style={{ fontSize: 18, fontWeight: 600 }}>{next.task.prompt}</p>

          {!result && (
            <form onSubmit={handleSubmit}>
              {isChoice ? (
                <div className="options">
                  {next.task.options.map((option) => (
                    <label className="option" key={option}>
                      <input
                        type="radio"
                        name="choice"
                        value={option}
                        checked={answer === option}
                        onChange={() => setAnswer(option)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : isFreeText ? (
                <div className="field">
                  <textarea
                    id="practice-free-text"
                    name="answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    minLength={10}
                    maxLength={1000}
                    aria-label={t(locale, "practice.yourText")}
                  />
                </div>
              ) : (
                <div className="field">
                  <input
                    id="practice-text-answer"
                    name="answer"
                    type="text"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    maxLength={200}
                    aria-label={t(locale, "practice.yourAnswer")}
                  />
                </div>
              )}
              {restoredNote && <p className="muted" role="status">{restoredNote}</p>}
              {submitError && <p className="error" role="alert">{submitError}</p>}
              <button className="btn" type="submit" disabled={pending || !answer.trim()}>
                {pending
                  ? isFreeText
                    ? t(locale, "practice.analyzing")
                    : t(locale, "practice.checking")
                  : t(locale, "practice.answer")}
              </button>
            </form>
          )}

          {result && (
            <>
              <div className={`feedback ${result.isCorrect === false ? "bad" : result.isCorrect ? "good" : "note"}`}>
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  {result.isCorrect === true && <FontAwesomeIcon icon={faCheck} />}
                  {result.isCorrect === false && <FontAwesomeIcon icon={faXmark} />}
                  <span>
                    {result.isCorrect === true && t(locale, "practice.good")}
                    {result.isCorrect === false && t(locale, "practice.wrong")}
                    {result.isCorrect === null && t(locale, "practice.saved")}
                  </span>
                </div>
                {result.explanation && (
                  <div style={{ marginTop: 8, fontSize: "0.95rem", lineHeight: 1.5, opacity: 0.95 }}>
                    {result.explanation}
                  </div>
                )}
              </div>

              {isTopicCompleted && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                  }}
                >
                  <FontAwesomeIcon icon={faTrophy} style={{ color: "var(--accent)", fontSize: 18 }} />
                  <div>
                    <strong style={{ display: "block" }}>
                      {isRu ? "Тема полностью пройдена (100%)!" : "Тэма цалкам пройдзена (100%)!"}
                    </strong>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {isRu
                        ? `Вы решили все задания по теме «${next.skillTitle}». Можно переходить к следующей теме.`
                        : `Вы рашылі ўсе заданні па тэме «${next.skillTitle}». Можна пераходзіць да наступнай тэмы.`}
                    </span>
                  </div>
                </div>
              )}

              {loadError && <p className="error" role="alert">{loadError}</p>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                {isTopicCompleted ? (
                  <>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void loadNext(null, false)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <span>{isRu ? "Перейти к следующей теме" : "Перайсці да наступнай тэмы"}</span>
                      <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => void loadNext(selectedSkillId, false)}
                    >
                      {isRu ? "Повторить задание из этой темы" : "Паўтарыць заданне з гэтай тэмы"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void loadNext(selectedSkillId, false)}
                    >
                      {isRu ? "Следующее задание по теме" : "Наступнае заданне па тэме"}
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => void loadNext(null, false)}
                    >
                      {isRu ? "Адаптивный подбор (следующая слабая тема)" : "Адаптыўны падбор (наступная слабая тэма)"}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {weakTopics.length > 0 && (
        <section className="card" style={{ marginBottom: 24 }}>
          <p className="kicker" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FontAwesomeIcon icon={faCircleExclamation} style={{ color: "#d97706" }} />
            <span>
              {isRu
                ? "Ваши слабые темы (рекомендовано по итогам диагностики и практики)"
                : "Вашы слабыя тэмы (рэкамендавана па выніках дыягностыкі і практыкі)"}
            </span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10, marginTop: 10 }}>
            {weakTopics.map((skill) => {
              const isCurrent = next.skillId === skill.skillId;
              const skillSolved = skill.solvedTasks ?? 0;
              const skillTotal = skill.totalTasks ?? 6;
              const skillPct = skillTotal > 0 ? Math.round((skillSolved / skillTotal) * 100) : 0;
              return (
                <button
                  key={skill.skillId}
                  type="button"
                  onClick={() => void loadNext(skill.skillId, true)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: isCurrent ? "2px solid var(--accent)" : "1px solid var(--line)",
                    background: isCurrent ? "var(--accent-soft)" : "var(--bg-subtle)",
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <strong style={{ fontSize: 14 }}>{skill.titleBe}</strong>
                    <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {skillSolved}/{skillTotal} · {skillPct}%
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {skill.moduleTitle}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {modulesMap.size > 0 && (
        <section className="card">
          <p className="kicker" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FontAwesomeIcon icon={faLayerGroup} />
            <span>
              {isRu
                ? "Все учебные модули (нажмите на тему, чтобы открыть её теорию и тест)"
                : "Усе вучэбныя модулі (націсніце на тэму, каб адкрыць яе тэорыю і тэст)"}
            </span>
          </p>
          <div style={{ display: "grid", gap: 18, marginTop: 12 }}>
            {[...modulesMap.entries()].map(([moduleTitle, skills]) => (
              <div key={moduleTitle}>
                <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>{moduleTitle}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
                  {skills
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((skill) => {
                      const isCurrent = next.skillId === skill.skillId;
                      const skillSolved = skill.solvedTasks ?? 0;
                      const skillTotal = skill.totalTasks ?? 6;
                      const skillPct = skillTotal > 0 ? Math.round((skillSolved / skillTotal) * 100) : 0;
                      const isCompleted = skillTotal > 0 && skillSolved >= skillTotal;
                      const diagPassedOnly =
                        skillSolved === 0 &&
                        (skill.practiceAttempts ?? 0) === 0 &&
                        skill.attempts > 0 &&
                        skill.mastery >= 0.8 &&
                        skill.errorCount === 0;
                      return (
                        <button
                          key={skill.skillId}
                          type="button"
                          onClick={() => void loadNext(skill.skillId, true)}
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: isCurrent ? "2px solid var(--accent)" : "1px solid var(--line)",
                            background: isCurrent ? "var(--accent-soft)" : "transparent",
                            color: "var(--text)",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 500 }}>
                            {skill.titleBe}
                          </span>
                          <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                            {isCompleted ? (
                              <>
                                <FontAwesomeIcon icon={faCheck} style={{ color: "var(--accent)", marginRight: 4 }} />
                                100%
                              </>
                            ) : skillSolved > 0 ? (
                              `${skillSolved}/${skillTotal} (${skillPct}%)`
                            ) : diagPassedOnly ? (
                              isRu ? "Тест ✓ · 0%" : "Тэст ✓ · 0%"
                            ) : (
                              "0%"
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
