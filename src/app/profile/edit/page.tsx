import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { ProfileSettings } from "@/components/profile-settings";

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) redirect("/login");

  return (
    <main className="wrap">
      <Link className="profile-back-link" href="/profile">← {t(locale, "profile.back")}</Link>
      <h1 style={{ margin: "0 0 1.8rem" }}>{t(locale, "profile.edit")}</h1>
      <ProfileSettings
        locale={locale}
        name={user.displayName}
        email={user.email}
        avatarData={user.avatarData}
        isGoogleUser={user.passwordHash === "google"}
      />
    </main>
  );
}
