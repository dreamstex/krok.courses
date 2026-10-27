import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function LoginPage() {
  const locale = await getLocale();
  return (
    <main className="wrap auth-wrap">
      <div className="auth-container">
        <h1>{t(locale, "auth.loginTitle")}</h1>
        <p className="lead">{t(locale, "auth.loginLead")}</p>
        <AuthForm mode="login" locale={locale} />
        <p className="muted auth-switch">
          {t(locale, "auth.noAccount")} <Link href="/register">{t(locale, "auth.register")}</Link>
        </p>
      </div>
    </main>
  );
}
