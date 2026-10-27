import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}


export async function requireUser() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user) return { user: null, response: jsonError(t(locale, "api.signIn"), 401) };
  return { user, response: null };
}
