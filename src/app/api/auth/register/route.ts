import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation/schemas";
import { jsonError } from "@/lib/api";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export async function POST(request: Request) {
  const locale = await getLocale();
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(t(locale, "auth.invalidData"), 400);
  const { email, password, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError(t(locale, "auth.emailExists"), 409);

  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash: await hashPassword(password),
      preferences: { create: {} },
    },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
