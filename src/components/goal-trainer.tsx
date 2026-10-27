"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";
import { gradeClosedTask } from "@/lib/learning/task-view";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBullseye,
  faTrophy,
  faPlus,
  faCheck,
  faXmark,
  faArrowRight,
  faArrowLeft,
  faRotateRight,
  faBookOpen,
} from "@fortawesome/free-solid-svg-icons";

interface TaskItem {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  answers: string[];
  explanation: string | null;
  explanationRu?: string | null;
}

interface GoalTrainerProps {
  goalId: string;
  chatSessionId?: string | null;
  initialScore?: number | null;
  initialMaxScore?: number | null;
  title: string;
  summary: string;
  theory?: string | null;
  initialSkipTheory?: boolean;
  status: string;
  tasks: TaskItem[];
  locale: Locale;
}

export function GoalTrainer({
  goalId,
  chatSessionId,
  initialScore,
  title,
  summary,
  theory,
  initialSkipTheory = false,
  status: initialStatus,
  tasks: initialTasks,
  locale,
}: GoalTrainerProps) {
  const router = useRouter();
  const isRu = locale === "ru";
  const isAlreadyCompleted = initialStatus === "completed";
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [status, setStatus] = useState(initialStatus);
  const [showTheoryCard, setShowTheoryCard] = useState(!isAlreadyCompleted && !initialSkipTheory && Boolean(theory));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(initialScore ?? 0);
  const [isFinished, setIsFinished] = useState(isAlreadyCompleted);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTask = tasks[currentIndex];

  async function handleCheck() {
    if (!currentAnswer.trim() || isAnswered || !currentTask) return;

    const isRight = gradeClosedTask(
      {
        type: (currentTask.type as "choice" | "fill" | "correction") ?? "fill",
        prompt: currentTask.prompt,
        answers: currentTask.answers,
      },
      currentAnswer,
    );

    setIsCorrect(isRight);
    setAiExplanation(null);
    if (isRight) {
      setCorrectCount((c) => c + 1);
    }
    setIsAnswered(true);

    try {
      const res = await fetch("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: crypto.randomUUID(),
          taskId: currentTask.id,
          answer: currentAnswer.trim(),
          usedHint: "0",
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        if (!isRight && data.isCorrect === true) {
          setIsCorrect(true);
          setCorrectCount((c) => c + 1);
        }
        if (typeof data.explanation === "string" && data.explanation.trim()) {
          setAiExplanation(data.explanation);
        }
      }
    } catch {
    }
  }

  function handleNext() {
    if (currentIndex + 1 < tasks.length) {
      setCurrentIndex((idx) => idx + 1);
      setCurrentAnswer("");
      setIsAnswered(false);
      setIsCorrect(false);
      setAiExplanation(null);
    } else {
      setIsFinished(true);
      const finalScore = correctCount;
      const total = tasks.length;
      void fetch(`/api/goals/${goalId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: finalScore, maxScore: total }),
      });
      setStatus("completed");
    }
  }

  function handleRetake() {
    setCurrentIndex(0);
    setCurrentAnswer("");
    setIsAnswered(false);
    setIsCorrect(false);
    setAiExplanation(null);
    setCorrectCount(0);
    setIsFinished(false);
    setShowTheoryCard(Boolean(theory));
  }

  async function handleGenerateMore() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goalId}/expand`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.addedCount > 0 && Array.isArray(data.tasks)) {
        const nextIdx = tasks.length;
        setTasks((prev) => [...prev, ...data.tasks]);
        setCurrentIndex(nextIdx);
        setIsFinished(false);
        setIsAnswered(false);
        setCurrentAnswer("");
        router.refresh();
      } else {
        setError(t(locale, "common.tryAgain"));
      }
    } catch {
      setError(t(locale, "common.noConnection"));
    } finally {
      setPending(false);
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="card">
        <p className="muted">{t(locale, "goals.noActive")}</p>
        <Link
          href="/chat"
          className="btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <Image src="/krokki.svg" alt="" width={18} height={18} className="krokki-btn-icon" />
          <span>{t(locale, "goals.askKrokki")}</span>
        </Link>
      </div>
    );
  }

  const discussResultsUrl = `/chat?${chatSessionId ? `session=${chatSessionId}&` : ""}testId=${goalId}`;
  const discussTheoryUrl = `/chat?theoryPlanId=${encodeURIComponent(goalId)}&returnTo=${encodeURIComponent(`/goals/${goalId}?skipTheory=1`)}`;

  if (showTheoryCard && theory) {
    return (
      <section className="card" style={{ maxWidth: 660 }}>
        <p className="kicker" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FontAwesomeIcon icon={faBookOpen} />
          <span>{isRu ? "Краткая теория перед тестом" : "Кароткая тэорыя перад тэстам"}</span>
        </p>
        <h2 style={{ marginTop: 4, marginBottom: 6 }}>{title}</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>{summary}</p>

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
          {theory}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            className="btn"
            type="button"
            onClick={() => setShowTheoryCard(false)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <span>
              {isRu
                ? `Перейти к тесту (${tasks.length} заданий)`
                : `Перайсці да тэсту (${tasks.length} заданняў)`}
            </span>
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
    );
  }

  if (isFinished) {
    const total = tasks.length;
    const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return (
      <section className="card" style={{ maxWidth: 600 }}>
        <p className="kicker">
          <FontAwesomeIcon icon={faBullseye} style={{ marginRight: 6 }} />
          {t(locale, "goals.resultTitle")}
        </p>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <p className="lead">{summary}</p>

        <div className="result-card-box">
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>
            {correctCount} / {total} ({percent}%)
          </div>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            {t(locale, "goals.resultScore", { correct: correctCount, total, percent })}
          </div>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <Link
            href={discussResultsUrl}
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Image src="/krokki.svg" alt="" width={18} height={18} className="krokki-btn-icon" />
            <span>{t(locale, "goals.askKrokki")}</span>
          </Link>
          <button className="btn secondary" type="button" onClick={handleRetake}>
            <FontAwesomeIcon icon={faRotateRight} style={{ marginRight: 6 }} />
            {t(locale, "goals.retake")}
          </button>
          <button className="btn secondary" type="button" onClick={handleGenerateMore} disabled={pending}>
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
            {t(locale, "goals.generateMore")}
          </button>
          <Link href="/goals" className="btn secondary">
            <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6 }} />
            {t(locale, "goals.title")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="card" style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <span className="kicker">
          {currentIndex + 1} / {tasks.length}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {theory && (
            <button
              type="button"
              onClick={() => setShowTheoryCard(true)}
              className="btn secondary"
              style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <FontAwesomeIcon icon={faBookOpen} />
              <span>{isRu ? "Теория по теме" : "Тэорыя па тэме"}</span>
            </button>
          )}
          <span className="muted" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {status === "completed" ? (
              <>
                <FontAwesomeIcon icon={faTrophy} />
                {t(locale, "goals.completedBadge")}
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faBullseye} />
                {title}
              </>
            )}
          </span>
        </div>
      </div>

      <div className="bar" style={{ marginBottom: 20 }}>
        <span style={{ width: `${Math.round(((currentIndex + 1) / tasks.length) * 100)}%` }} />
      </div>

      <h2 style={{ fontSize: 20, margin: "0 0 16px" }}>{currentTask?.prompt}</h2>

      {currentTask?.type === "choice" && currentTask.options.length > 0 ? (
        <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
          {currentTask.options.map((option) => {
            const isSelected = currentAnswer === option;
            let optionClass = "option-btn";

            if (isAnswered) {
              const isOptionCorrect = currentTask.answers.some(
                (a) => a.trim().toLowerCase() === option.trim().toLowerCase(),
              );
              if (isOptionCorrect) {
                optionClass += " correct";
              } else if (isSelected) {
                optionClass += " wrong";
              }
            } else if (isSelected) {
              optionClass += " selected";
            }

            return (
              <button
                key={option}
                type="button"
                onClick={() => !isAnswered && setCurrentAnswer(option)}
                disabled={isAnswered}
                className={optionClass}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="field" style={{ marginBottom: 16 }}>
          <label htmlFor="fill-answer">{t(locale, "practice.yourAnswer")}</label>
          <input
            id="fill-answer"
            name="fillAnswer"
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            disabled={isAnswered}
            placeholder="..."
            style={{ fontSize: 16, padding: "10px 14px" }}
          />
        </div>
      )}

      {isAnswered && currentTask && (
        <div className={isCorrect ? "feedback-success" : "feedback-error"}>
          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <FontAwesomeIcon icon={isCorrect ? faCheck : faXmark} />
            {isCorrect ? t(locale, "practice.good") : t(locale, "practice.wrong")}
          </div>
          {!isCorrect && (
            <div style={{ marginTop: 4, fontWeight: 600 }}>
              {t(locale, "onboarding.showAnswer")}: {currentTask.answers.join(" / ")}
            </div>
          )}
          {(aiExplanation || currentTask.explanation || currentTask.explanationRu) && (
            <div style={{ marginTop: 6, fontSize: 14, whiteSpace: "pre-line" }}>
              {aiExplanation ?? (locale === "ru" && currentTask.explanationRu ? currentTask.explanationRu : currentTask.explanation)}
            </div>
          )}
        </div>
      )}

      <div>
        {!isAnswered ? (
          <button className="btn" type="button" onClick={handleCheck} disabled={!currentAnswer.trim()}>
            {t(locale, "practice.answer")}
          </button>
        ) : (
          <button className="btn" type="button" onClick={handleNext}>
            {currentIndex + 1 < tasks.length ? t(locale, "practice.next") : t(locale, "goals.resultTitle")}
            <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
          </button>
        )}
      </div>
    </section>
  );
}
