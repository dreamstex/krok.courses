import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DiagnosticForm } from "@/components/diagnostic-form";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function DiagnosticPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect("/login");
  if (!user.preferences?.onboardedAt) redirect("/onboarding");
  if (user.preferences?.diagnosedAt) redirect("/dashboard");

  return (
    <main className="wrap">
      <p className="kicker">{t(locale, "diagnostic.step")}</p>
      <h1>{t(locale, "diagnostic.title")}</h1>
      <p className="lead">{t(locale, "diagnostic.lead")}</p>
      <DiagnosticForm locale={locale} />
    </main>
  );
}
