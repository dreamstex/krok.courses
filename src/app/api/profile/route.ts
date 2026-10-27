import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, createSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { jsonError } from "@/lib/api";
import { updateFirebasePassword } from "@/lib/firebase/server";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  avatarData: z.string().max(700_000).nullable(),
  currentPassword: z.string().max(100).optional(),
  newPassword: z.string().max(100).optional(),
});

export async function PATCH(request: Request) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) return jsonError(t(locale, "api.signIn"), 401);

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(t(locale, "profile.invalid"), 400);
  const { displayName, avatarData, currentPassword, newPassword } = parsed.data;

  if (avatarData !== null) {
    const image = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(avatarData);
    if (!image || Buffer.from(image[2], "base64").byteLength > 500_000) {
      return jsonError(t(locale, "profile.avatarInvalid"), 400);
    }
  }

  const hasCurrentPassword = Boolean(currentPassword && currentPassword.trim().length > 0);
  const hasNewPassword = Boolean(newPassword && newPassword.trim().length > 0);

  if (hasCurrentPassword && !hasNewPassword) {
    return jsonError(
      locale === "ru" ? "Введите новый пароль." : "Увядзіце новы пароль.",
      400,
    );
  }

  if (!hasCurrentPassword && hasNewPassword) {
    return jsonError(
      locale === "ru" ? "Введите текущий пароль." : "Увядзіце бягучы пароль.",
      400,
    );
  }

  const changingPassword = hasCurrentPassword && hasNewPassword;
  if (changingPassword) {
    if (newPassword!.length < 8) {
      return jsonError(t(locale, "profile.passwordShort"), 400);
    }

    if (user.passwordHash === "google") {
      return jsonError(
        locale === "ru"
          ? "Этот аккаунт авторизован через Google. Пароль управляется в настройках Google."
          : "Гэты акаўнт аўтарызаваны праз Google. Пароль кіруецца ў наладах Google.",
        400,
      );
    }

    if (user.passwordHash === "firebase") {
      const updateResult = await updateFirebasePassword(user.email, currentPassword!, newPassword!);
      if (!updateResult.success) {
        if (updateResult.errorCode === "auth/wrong-password" || updateResult.error === "INVALID_PASSWORD") {
          return jsonError(t(locale, "profile.passwordWrong"), 400);
        }
        return jsonError(
          locale === "ru"
            ? "Не удалось изменить пароль. Проверьте правильность текущего пароля."
            : "Не атрымалася змяніць пароль. Праверце правільнасць бягучага пароля.",
          400,
        );
      }
    } else {
      if (!(await verifyPassword(currentPassword!, user.passwordHash))) {
        return jsonError(t(locale, "profile.passwordWrong"), 400);
      }
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName,
      avatarData,
      ...(changingPassword && user.passwordHash !== "firebase" && user.passwordHash !== "google"
        ? { passwordHash: await hashPassword(newPassword!) }
        : {}),
    },
  });

  if (changingPassword) {
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
    await createSession(user.id);
  }

  return NextResponse.json({ ok: true });
}
