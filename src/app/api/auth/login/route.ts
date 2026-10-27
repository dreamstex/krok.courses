import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";
import { jsonError } from "@/lib/api";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export async function POST(request: Request) {
  const locale = await getLocale();
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(t(locale, "auth.invalidData"), 400);
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) return jsonError(t(locale, "auth.badCredentials"), 401);

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
