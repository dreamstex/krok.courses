"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

const MINUTES = [5, 10, 15, 20, 30];

export function OnboardingForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [knowledgeLevel, setKnowledgeLevel] = useState<"none" | "some" | "good">("some");
  const [interestArea, setInterestArea] = useState<"all" | "speaking" | "grammar" | "vocabulary">("all");
  const [speakingContext, setSpeakingContext] = useState("Штодзённыя размовы і кафэ");
  const [focusTopics, setFocusTopics] = useState<string[]>([]);
  const [minutesPerDay, setMinutesPerDay] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleTopic(topic: string) {
    setFocusTopics((current) =>
      current.includes(topic) ? current.filter((t) => t !== topic) : [...current, topic],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgeLevel,
          interestArea,
          speakingContext: interestArea === "speaking" ? speakingContext : undefined,
          focusTopics: interestArea === "grammar" || interestArea === "vocabulary" ? focusTopics : [],
          minutesPerDay,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? t(locale, "common.tryAgain"));
        return;
      }
      router.push(data.redirectTo ?? "/diagnostic");
      router.refresh();
    } catch {
      setError(t(locale, "common.noConnection"));
    } finally {
      setPending(false);
    }
  }

  const grammarOptions = [
    { id: "spelling", labelBe: "Правапіс і націск (ў, і, апостраф, аканне)", labelRu: "Правописание и ударение (ў, і, апостроф, аканье)" },
    { id: "cases", labelBe: "Склоны назоўнікаў і канчаткі", labelRu: "Падежи существительных и окончания" },
    { id: "verbs", labelBe: "Часы і спражэнне дзеясловаў", labelRu: "Времена и спряжение глаголов" },
    { id: "syntax", labelBe: "Сінтаксіс, злучнікі і пунктуацыя", labelRu: "Синтаксис, союзы и пунктуация" },
  ];

  const vocabOptions = [
    { id: "family", labelBe: "Сям'я, сябры і дом", labelRu: "Семья, друзья и дом" },
    { id: "food", labelBe: "Ежа, стравы і пакупкі", labelRu: "Еда, блюда и покупки" },
    { id: "city", labelBe: "Горад, транспарт і арыентацыя", labelRu: "Город, транспорт и ориентация" },
    { id: "culture", labelBe: "Культура, гісторыя і святы", labelRu: "Культура, история и праздники" },
    { id: "modern", labelBe: "Сучаснае жыццё, праца і IT", labelRu: "Современная жизнь, работа и IT" },
  ];

  const speakingOptions = [
    { id: "daily", labelBe: "Штодзённыя размовы, знаёмства і кафэ", labelRu: "Повседневные разговоры, знакомство и кафе" },
    { id: "travel", labelBe: "Падарожжы па Беларусі і транспарт", labelRu: "Путешествия по Беларуси и транспорт" },
    { id: "work", labelBe: "Праца, універсітэт і дзелавыя зносіны", labelRu: "Работа, университет и деловое общение" },
    { id: "social", labelBe: "Сяброўскія сустрэчы і сацсеткі", labelRu: "Дружеские встречи и соцсети" },
  ];

  return (
    <form onSubmit={handleSubmit} className="card" style={{ width: "100%", margin: "0 auto" }}>
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
        <legend style={{ fontWeight: 600, fontSize: 16, marginBottom: 10 }}>
          {t(locale, "onboarding.levelQuestion")}
        </legend>
        <div style={{ display: "grid", gap: 10 }}>
          <label
            style={{
              display: "block",
              padding: "12px 14px",
              border: knowledgeLevel === "none" ? "2px solid var(--accent)" : "1px solid var(--line)",
              borderRadius: 8,
              cursor: "pointer",
              background: knowledgeLevel === "none" ? "var(--accent-soft)" : "transparent",
            }}
          >
            <input
              type="radio"
              name="knowledgeLevel"
              value="none"
              checked={knowledgeLevel === "none"}
              onChange={() => setKnowledgeLevel("none")}
              style={{ marginRight: 8 }}
            />
            <strong>{t(locale, "onboarding.levelNone")}</strong>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {t(locale, "onboarding.levelNoneDesc")}
            </div>
          </label>

          <label
            style={{
              display: "block",
              padding: "12px 14px",
              border: knowledgeLevel === "some" ? "2px solid var(--accent)" : "1px solid var(--line)",
              borderRadius: 8,
              cursor: "pointer",
              background: knowledgeLevel === "some" ? "var(--accent-soft)" : "transparent",
            }}
          >
            <input
              type="radio"
              name="knowledgeLevel"
              value="some"
              checked={knowledgeLevel === "some"}
              onChange={() => setKnowledgeLevel("some")}
              style={{ marginRight: 8 }}
            />
            <strong>{t(locale, "onboarding.levelSome")}</strong>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {t(locale, "onboarding.levelSomeDesc")}
            </div>
          </label>

          <label
            style={{
              display: "block",
              padding: "12px 14px",
              border: knowledgeLevel === "good" ? "2px solid var(--accent)" : "1px solid var(--line)",
              borderRadius: 8,
              cursor: "pointer",
              background: knowledgeLevel === "good" ? "var(--accent-soft)" : "transparent",
            }}
          >
            <input
              type="radio"
              name="knowledgeLevel"
              value="good"
              checked={knowledgeLevel === "good"}
              onChange={() => setKnowledgeLevel("good")}
              style={{ marginRight: 8 }}
            />
            <strong>{t(locale, "onboarding.levelGood")}</strong>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {t(locale, "onboarding.levelGoodDesc")}
            </div>
          </label>
        </div>
      </fieldset>

      <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
        <legend style={{ fontWeight: 600, fontSize: 16, marginBottom: 10 }}>
          {t(locale, "onboarding.interestQuestion")}
        </legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          {(["all", "speaking", "grammar", "vocabulary"] as const).map((area) => (
            <button
              type="button"
              key={area}
              onClick={() => setInterestArea(area)}
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: interestArea === area ? "2px solid var(--accent)" : "1px solid var(--line)",
                background: interestArea === area ? "var(--accent-soft)" : "transparent",
                color: "var(--text)",
                fontWeight: interestArea === area ? 600 : 400,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {area === "all" && t(locale, "onboarding.interestAll")}
              {area === "speaking" && t(locale, "onboarding.interestSpeaking")}
              {area === "grammar" && t(locale, "onboarding.interestGrammar")}
              {area === "vocabulary" && t(locale, "onboarding.interestVocabulary")}
            </button>
          ))}
        </div>
      </fieldset>

      {interestArea === "speaking" && (
        <div style={{ marginBottom: 24, padding: "14px", background: "var(--bg-subtle)", borderRadius: 8 }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 8 }}>{t(locale, "onboarding.speakingContextTitle")}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {speakingOptions.map((opt) => (
              <label key={opt.id} style={{ display: "flex", alignItems: "center", cursor: "pointer", fontSize: 14 }}>
                <input
                  type="radio"
                  name="speakingContext"
                  value={opt.labelBe}
                  checked={speakingContext === opt.labelBe}
                  onChange={() => setSpeakingContext(opt.labelBe)}
                  style={{ marginRight: 8 }}
                />
                {locale === "ru" ? opt.labelRu : opt.labelBe}
              </label>
            ))}
          </div>
        </div>
      )}

      {interestArea === "grammar" && (
        <div style={{ marginBottom: 24, padding: "14px", background: "var(--bg-subtle)", borderRadius: 8 }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 8 }}>{t(locale, "onboarding.grammarTopicsTitle")}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {grammarOptions.map((opt) => (
              <label key={opt.id} style={{ display: "flex", alignItems: "center", cursor: "pointer", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={focusTopics.includes(opt.id)}
                  onChange={() => toggleTopic(opt.id)}
                  style={{ marginRight: 8 }}
                />
                {locale === "ru" ? opt.labelRu : opt.labelBe}
              </label>
            ))}
          </div>
        </div>
      )}

      {interestArea === "vocabulary" && (
        <div style={{ marginBottom: 24, padding: "14px", background: "var(--bg-subtle)", borderRadius: 8 }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 8 }}>{t(locale, "onboarding.vocabularyTopicsTitle")}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {vocabOptions.map((opt) => (
              <label key={opt.id} style={{ display: "flex", alignItems: "center", cursor: "pointer", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={focusTopics.includes(opt.id)}
                  onChange={() => toggleTopic(opt.id)}
                  style={{ marginRight: 8 }}
                />
                {locale === "ru" ? opt.labelRu : opt.labelBe}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="field" style={{ marginBottom: 24 }}>
        <label htmlFor="minutesPerDay">{t(locale, "onboarding.minutesLabel")}</label>
        <select
          id="minutesPerDay"
          value={minutesPerDay}
          onChange={(event) => setMinutesPerDay(Number(event.target.value))}
        >
          {MINUTES.map((minutes) => (
            <option key={minutes} value={minutes}>
              {t(locale, "onboarding.minutes", { n: minutes })}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <button className="btn" type="submit" disabled={pending} style={{ width: "100%", padding: "12px 18px", fontSize: 16 }}>
        {pending ? t(locale, "onboarding.saving") : t(locale, "onboarding.startLearning")}
      </button>
    </form>
  );
}
