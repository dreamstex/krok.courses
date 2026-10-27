import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
config.autoAddCss = false;
import { getCurrentUser } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { PwaRegister } from "@/components/pwa-register";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { AmbientBackground } from "@/components/ambient-background";

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Крок – белорусский язык шаг за шагом",
  description: "Адаптивная система изучения белорусского языка",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Крок",
  },
  icons: {
    icon: [
      { url: "/favic.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);

  return (
    <html lang={locale}>
      <body>
        <PwaRegister />
        <AmbientBackground />
        <header className="topbar">
          <Link href={user ? "/dashboard" : "/"} className="brand" aria-label={t(locale, "auth.homeLabel")}>
            <Image src="/krok_black.svg" alt="KROK" width={112} height={41} priority className="logo-light" />
            <Image src="/krok_white.svg" alt="KROK" width={112} height={41} priority className="logo-dark" />
          </Link>
          {user && (
            <nav className="nav" aria-label={t(locale, "nav.title")}>
              <Link href="/dashboard">{t(locale, "nav.home")}</Link>
              <Link href="/practice">{t(locale, "nav.practice")}</Link>
              <Link href="/chat" className="nav-krokki-link">
                <Image
                  src="/krokki.svg"
                  alt=""
                  width={18}
                  height={18}
                  className="nav-krokki-icon"
                />
                <span>{t(locale, "nav.chat")}</span>
              </Link>
              <Link href="/goals">{t(locale, "nav.goals")}</Link>
              <Link href="/mistakes">{t(locale, "nav.mistakes")}</Link>
              <Link href="/profile">{t(locale, "nav.profile")}</Link>
            </nav>
          )}
          <div className="header-tools">
            <LanguageSwitcher locale={locale} />
            <ThemeToggle locale={locale} />
          </div>
        </header>
        {children}
        {user && <BottomTabBar locale={locale} />}
      </body>
    </html>
  );
}
