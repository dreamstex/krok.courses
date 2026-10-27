"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUtensils,
  faPenNib,
  faBook,
  faLanguage,
  faBullseye,
  faPaperPlane,
  faArrowRight,
  faArrowLeft,
  faPlus,
  faClockRotateLeft,
  faTrashCan,
  faXmark,
  faComments,
} from "@fortawesome/free-solid-svg-icons";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  planId?: string | null;
  goalTitle?: string | null;
  tasksCount?: number;
}

interface ChatSessionItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface KrokkiChatProps {
  locale: Locale;
  initialSessionId?: string;
  initialTestId?: string;
  initialTopicSkillId?: string;
  initialTheoryPlanId?: string;
  returnTo?: string;
}

export function KrokkiChat({
  locale,
  initialSessionId,
  initialTestId,
  initialTopicSkillId,
  initialTheoryPlanId,
  returnTo,
}: KrokkiChatProps) {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId ?? null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedReturnTo] = useState<string | undefined>(returnTo);
  const isRu = locale === "ru";

  const getWelcomeMessage = useCallback((): Message => ({
    id: "welcome",
    role: "assistant",
    content: isRu
      ? "Привет! Я Крокки − твой дружелюбный маскот и репетитор по белорусскому языку. Спроси у меня любое правило, перевод или попроси составить мини-тест для тренировки!"
      : "Прывітанне! Я Кроккі − твой прыязны маскот і рэпетытар па беларускай мове. Спытай у мяне любое правіла, пераклад альбо папрасі скласці міні-тэст для трэніроўкі!",
  }), [isRu]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: locale === "ru"
        ? "Привет! Я Крокки − твой дружелюбный маскот и репетитор по белорусскому языку. Спроси у меня любое правило, перевод или попроси составить мини-тест для тренировки!"
        : "Прывітанне! Я Кроккі − твой прыязны маскот і рэпетытар па беларускай мове. Спытай у мяне любое правіла, пераклад ці папрасі скласці міні-тэст для трэніроўкі!",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const handledTriggerRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/krokki/sessions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshSessions = useCallback(() => {
    fetch("/api/krokki/sessions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;

    let isMounted = true;
    fetch(`/api/krokki/chat?sessionId=${activeSessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages((prev) => {
            const prevById = new Map(prev.map((m) => [m.id, m]));
            const prevByPlanId = new Map(
              prev.filter((m) => m.planId).map((m) => [m.planId as string, m]),
            );

            return data.messages.map((m: Message) => {
              const existing = prevById.get(m.id) ?? (m.planId ? prevByPlanId.get(m.planId) : undefined);
              return {
                ...m,
                goalTitle: m.goalTitle ?? existing?.goalTitle,
                tasksCount: m.tasksCount ?? existing?.tasksCount,
              };
            });
          });
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [activeSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const sendMessage = useCallback(
    async (
      textToSend: string,
      opts?: {
        testId?: string;
        topicSkillId?: string;
        theoryPlanId?: string;
        forceNewSession?: boolean;
      },
    ) => {
      if (!textToSend.trim() || pending) return;

      const userMessage: Message = {
        id: `usr-${crypto.randomUUID()}`,
        role: "user",
        content: textToSend.trim(),
      };

      setMessages((prev) => (opts?.forceNewSession ? [userMessage] : [...prev, userMessage]));
      setInput("");
      setError(null);
      setPending(true);

      const historyPayload = opts?.forceNewSession
        ? []
        : messages
            .filter((m) => m.id !== "welcome")
            .slice(-6)
            .map((m) => ({
              role: m.role,
              content: m.content,
            }));

      try {
        const response = await fetch("/api/krokki/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: textToSend.trim(),
            sessionId: opts?.forceNewSession ? null : activeSessionId,
            testId: opts?.testId ?? undefined,
            topicSkillId: opts?.topicSkillId ?? undefined,
            theoryPlanId: opts?.theoryPlanId ?? undefined,
            history: historyPayload,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(data.error ?? t(locale, "common.tryAgain"));
          return;
        }

        const botMessage: Message = {
          id: `bot-${crypto.randomUUID()}`,
          role: "assistant",
          content: data.reply,
          planId: data.planId,
          goalTitle: data.goalTitle,
          tasksCount: data.tasksCount,
        };

        setMessages((prev) => [...prev, botMessage]);

        if (data.sessionId && data.sessionId !== activeSessionId) {
          setActiveSessionId(data.sessionId);
          const returnParam = savedReturnTo ? `&returnTo=${encodeURIComponent(savedReturnTo)}` : "";
          window.history.replaceState({}, "", `/chat?session=${data.sessionId}${returnParam}`);
          refreshSessions();
        }
      } catch {
        setError(t(locale, "common.noConnection"));
      } finally {
        setPending(false);
      }
    },
    [activeSessionId, locale, messages, pending, refreshSessions, savedReturnTo],
  );

  // в чат с параметром темы или теста сразу первое сообщение юзера
  useEffect(() => {
    const triggerKey = initialTopicSkillId
      ? `skill:${initialTopicSkillId}`
      : initialTheoryPlanId
        ? `theory:${initialTheoryPlanId}`
        : initialTestId
          ? `test:${initialTestId}`
          : null;

    if (!triggerKey || handledTriggerRef.current === triggerKey) return;

    const timer = window.setTimeout(() => {
      if (handledTriggerRef.current === triggerKey) return;
      handledTriggerRef.current = triggerKey;

      if (initialTopicSkillId) {
        const promptText = isRu
          ? "Привет, Крокки! Я открыл подготовленную теорию по этой теме перед тестом. Объясни, пожалуйста, главные правила простыми словами и приведи пару примеров!"
          : "Прывітанне, Кроккі! Я адкрыў падрыхтаваную тэорыю па гэтай тэме перад тэстам. Растлумач, калі ласка, галоўныя правілы простымі словамі і прывядзі пару прыкладаў!";
        void sendMessage(promptText, { topicSkillId: initialTopicSkillId, forceNewSession: true });
      } else if (initialTheoryPlanId) {
        const promptText = isRu
          ? "Привет, Крокки! Давай обсудим краткую теорию по теме этого теста перед тем, как я начну отвечать на вопросы."
          : "Прывітанне, Кроккі! Давай абмяркуем кароткую тэорыю па тэме гэтага тэсту перад тым, як я пачну адказваць на пытанні.";
        void sendMessage(promptText, { theoryPlanId: initialTheoryPlanId, forceNewSession: true });
      } else if (initialTestId) {
        const promptText = isRu
          ? "Привет, Крокки! Я только что завершил этот тест. Давай подробно разберём мои результаты и ошибки!"
          : "Прывітанне, Кроккі! Я толькі што завяршыў гэты тэст. Давай падрабязна разбяром мае вынікі і памылкі!";
        void sendMessage(promptText, { testId: initialTestId });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialTestId, initialTheoryPlanId, initialTopicSkillId, isRu, sendMessage]);

  function handleNewChat() {
    setActiveSessionId(null);
    setMessages([getWelcomeMessage()]);
    setInput("");
    setError(null);
    setHistoryOpen(false);
    window.history.replaceState({}, "", "/chat");
  }

  function handleSelectSession(sessionId: string) {
    if (sessionId === activeSessionId) {
      setHistoryOpen(false);
      return;
    }
    setActiveSessionId(sessionId);
    setHistoryOpen(false);
    window.history.replaceState({}, "", `/chat?session=${sessionId}`);
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/krokki/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          handleNewChat();
        }
      }
    } catch {
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  const quickPrompts = [
    {
      icon: faUtensils,
      text: isRu ? "Составь 5 заданий по теме еды" : "Складзі 5 заданняў па тэме ежы",
    },
    {
      icon: faPenNib,
      text: isRu ? "Как пишется «ў» и «у»?" : "Як пішацца «ў» і «у»?",
    },
    {
      icon: faBook,
      text: isRu ? "Сделай тест на падежи" : "Зрабі тэст на склоны",
    },
    {
      icon: faLanguage,
      text: isRu ? "Как сказать «добро пожаловать»?" : "Як сказаць «добро пожаловать»?",
    },
  ];

  return (
    <div className="chat-window-wrapper">
      {savedReturnTo && (
        <div
          className="card"
          style={{
            marginBottom: 14,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            background: "var(--accent-soft)",
            border: "1px solid var(--accent)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {isRu
              ? "Вы обсуждаете теорию темы с Крокки. Когда будете готовы — возвращайтесь к заданиям!"
              : "Вы абмяркоўваеце тэорыю тэмы з Кроккі. Калі будзеце гатовыя — вяртайцеся да заданняў!"}
          </span>
          <Link
            href={savedReturnTo}
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", padding: "8px 14px", fontSize: 14 }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>{isRu ? "Вернуться к тесту" : "Вярнуцца да тэсту"}</span>
          </Link>
        </div>
      )}

      <div className="chat-window">
        <div className="chat-header-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Image src="/krokki.svg" alt="Кроккі" width={38} height={38} priority />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Кроккі</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {activeSessionId && sessions.find((s) => s.id === activeSessionId)
                  ? sessions.find((s) => s.id === activeSessionId)?.title
                  : isRu ? "Новый диалог" : "Новы дыялог"}
              </div>
            </div>
          </div>

          <div className="chat-header-actions">
            <button
              type="button"
              onClick={handleNewChat}
              className="chat-action-btn primary"
              title={t(locale, "krokki.newChat")}
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>{t(locale, "krokki.newChat")}</span>
            </button>

            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              className={`chat-action-btn ${historyOpen ? "active" : ""}`}
              title={t(locale, "krokki.history")}
            >
              <FontAwesomeIcon icon={faClockRotateLeft} />
              <span>{t(locale, "krokki.history")}</span>
              {sessions.length > 0 && (
                <span className="chat-badge">{sessions.length}</span>
              )}
            </button>
          </div>
        </div>

        <div className="chat-messages-area">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: isUser ? "row-reverse" : "row",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                {!isUser && (
                  <Image
                    src="/krokki.svg"
                    alt="Кроккі"
                    width={32}
                    height={32}
                    style={{ borderRadius: "50%", flexShrink: 0 }}
                  />
                )}
                <div style={{ maxWidth: "78%" }}>
                  <div className={isUser ? "chat-bubble-user" : "chat-bubble-bot"} style={{ whiteSpace: "pre-wrap" }}>
                    {msg.content}
                  </div>

                  {msg.planId && (
                    <div className="chat-goal-card">
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "var(--accent)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <FontAwesomeIcon icon={faBullseye} />
                        {t(locale, "krokki.testCreated")}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, margin: "4px 0" }}>
                        {msg.goalTitle ?? t(locale, "goals.title")}
                      </div>
                      {msg.tasksCount ? (
                        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                          {t(locale, "goals.tasksCount", { n: msg.tasksCount })}
                        </div>
                      ) : null}
                      <Link
                        href={`/goals/${msg.planId}`}
                        className="btn"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          padding: "6px 12px",
                        }}
                      >
                        {t(locale, "krokki.startTest")}
                        <FontAwesomeIcon icon={faArrowRight} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {pending && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Image src="/krokki.svg" alt="Кроккі" width={32} height={32} style={{ borderRadius: "50%" }} />
              <div className="chat-bubble-bot" style={{ fontStyle: "italic", fontSize: 14 }}>
                {isRu ? "Крокки думает…" : "Кроккі думае…"}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-quick-row">
          {quickPrompts.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => void sendMessage(item.text)}
              disabled={pending}
              className="chat-quick-btn"
            >
              <FontAwesomeIcon icon={item.icon} />
              <span>{item.text}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="chat-input-row">
          <input
            id="krokki-chat-input"
            name="message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(locale, "krokki.inputPlaceholder")}
            disabled={pending}
            style={{ flex: 1, padding: "10px 14px", fontSize: 15, borderRadius: "10px", border: "#88888859 solid 1px" }}
          />
          <button
            className="btn chat-send-btn"
            type="submit"
            disabled={pending || !input.trim()}
            aria-label={t(locale, "krokki.send")}
          >
            <FontAwesomeIcon icon={faPaperPlane} />
            <span className="chat-send-label">{t(locale, "krokki.send")}</span>
          </button>
        </form>
        {error && <div className="error" style={{ padding: "4px 16px", margin: 0 }}>{error}</div>}
      </div>

      {historyOpen && (
        <div className="chat-history-overlay" onClick={() => setHistoryOpen(false)}>
          <div className="chat-history-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="chat-history-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16 }}>
                <FontAwesomeIcon icon={faClockRotateLeft} />
                <span>{t(locale, "krokki.history")}</span>
              </div>
              <button
                type="button"
                className="chat-history-close-btn"
                onClick={() => setHistoryOpen(false)}
                title="Закрыть"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="chat-history-list">
              <button
                type="button"
                onClick={handleNewChat}
                className="chat-history-new-btn"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>{t(locale, "krokki.newChat")}</span>
              </button>

              {sessions.length === 0 ? (
                <p className="muted" style={{ padding: "16px 8px", fontSize: 14 }}>
                  {t(locale, "krokki.noHistory")}
                </p>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const dateStr = new Date(s.updatedAt).toLocaleDateString(
                    isRu ? "ru-RU" : "be-BY",
                    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
                  );

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s.id)}
                      className={`chat-history-item ${isActive ? "active" : ""}`}
                    >
                      <div className="chat-history-item-body">
                        <div className="chat-history-item-title">
                          <FontAwesomeIcon
                            icon={faComments}
                            style={{ marginRight: 6, opacity: 0.7, fontSize: 13 }}
                          />
                          <span>{s.title}</span>
                        </div>
                        <div className="chat-history-item-meta">{dateStr}</div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => void handleDeleteSession(s.id, e)}
                        className="chat-history-delete-btn"
                        title={t(locale, "krokki.deleteChat")}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
