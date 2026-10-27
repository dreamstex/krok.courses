import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function RegisterPage() {
  const locale = await getLocale();
  return (
    <main className="wrap auth-wrap">
      <div className="auth-container">
        <h1>{t(locale, "auth.registerTitle")}</h1>
        <p className="lead">{t(locale, "auth.registerLead")}</p>
        <AuthForm mode="register" locale={locale} />
        <p className="muted auth-switch">
          {t(locale, "auth.hasAccount")} <Link href="/login">{t(locale, "auth.login")}</Link>
        </p>
      </div>
    </main>
  );
}
