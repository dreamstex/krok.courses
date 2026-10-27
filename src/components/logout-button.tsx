"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { t, type Locale } from "@/lib/i18n";

export function LogoutButton({ locale, compact = true }: { locale: Locale; compact?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      const auth = getFirebaseAuth();
      if (auth) {
        await signOut(auth).catch(() => undefined);
      }
    } catch {
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="btn danger"
      style={compact ? { padding: "4px 12px" } : undefined}
    >
      {t(locale, "nav.logout")}
    </button>
  );
}
