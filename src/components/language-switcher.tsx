"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();

  function changeLanguage(next: Locale) {
    document.cookie = `krok-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <label className="language-switcher">
      <span className="visually-hidden">{locale === "ru" ? "Язык интерфейса" : "Мова інтэрфейсу"}</span>
      <select value={locale} onChange={(event) => changeLanguage(event.target.value as Locale)} aria-label={locale === "ru" ? "Язык интерфейса" : "Мова інтэрфейсу"}>
        <option value="ru">Русский</option>
        <option value="be">Беларуская</option>
      </select>
    </label>
  );
}
