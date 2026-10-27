import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { KrokkiChat } from "@/components/krokki-chat";

export default async function ChatPage(props: {
  searchParams: Promise<{
    session?: string;
    testId?: string;
    topicSkillId?: string;
    theoryPlanId?: string;
    returnTo?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect("/login");

  const searchParams = await props.searchParams;
  const safeReturnTo =
    searchParams.returnTo && searchParams.returnTo.startsWith("/") && !searchParams.returnTo.startsWith("//")
      ? searchParams.returnTo
      : undefined;

  return (
    <main className="wrap">
      <p className="kicker">KROK AI</p>
      <h1>{t(locale, "krokki.chatTitle")}</h1>
      <p className="lead">{t(locale, "krokki.chatLead")}</p>
      <KrokkiChat
        locale={locale}
        initialSessionId={searchParams.session}
        initialTestId={searchParams.testId}
        initialTopicSkillId={searchParams.topicSkillId}
        initialTheoryPlanId={searchParams.theoryPlanId}
        returnTo={safeReturnTo}
      />
    </main>
  );
}
