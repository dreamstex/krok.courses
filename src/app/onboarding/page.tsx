import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { OnboardingForm } from "@/components/onboarding-form";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect("/login");
  if (user.preferences?.onboardedAt) redirect("/diagnostic");

  return (
    <main className="wrap">
      <div className="onboarding-container">
        <p className="kicker">{t(locale, "onboarding.step")}</p>
        <h1>{t(locale, "onboarding.title")}</h1>
        <p className="lead">{t(locale, "onboarding.lead")}</p>
        <OnboardingForm locale={locale} />
      </div>
    </main>
  );
}
