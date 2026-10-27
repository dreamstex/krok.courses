import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { verifyFirebaseIdToken } from "@/lib/firebase/server";
import { jsonError } from "@/lib/api";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

const sessionRequestSchema = z.object({
  idToken: z.string().min(10),
  displayName: z.string().trim().max(100).optional().nullable(),
});

export async function POST(request: Request) {
  const locale = await getLocale();

  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = sessionRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      console.warn("Session request validation failed:", parsed.error.issues);
      return jsonError(t(locale, "auth.invalidData"), 400);
    }

    const { idToken, displayName } = parsed.data;
    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified) {
      console.warn("Firebase ID token verification failed");
      return jsonError(t(locale, "auth.badCredentials"), 401);
    }

    console.log(`Firebase session login: uid=${verified.uid}, email=${verified.email}`);

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: verified.uid },
          { email: verified.email },
        ],
      },
      include: { preferences: true },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const finalDisplayName =
        (displayName && displayName.trim().length > 0)
          ? displayName.trim()
          : (verified.displayName || verified.email.split("@")[0]);

      const isGoogle = verified.signInProvider === "google.com";

      user = await prisma.user.create({
        data: {
          id: verified.uid,
          email: verified.email,
          displayName: finalDisplayName,
          avatarData: verified.avatarUrl || null,
          passwordHash: isGoogle ? "google" : "firebase",
          preferences: { create: {} },
        },
        include: { preferences: true },
      });
      console.log(`Created new user in database: id=${user.id}`);
    } else {
      const updateData: { displayName?: string; passwordHash?: string } = {};
      const newName = displayName && displayName.trim().length > 0 ? displayName.trim() : null;
      if (newName && newName !== user.displayName) {
        updateData.displayName = newName;
      }
      if (verified.signInProvider === "google.com" && user.passwordHash !== "google") {
        updateData.passwordHash = "google";
      } else if (verified.signInProvider === "password" && user.passwordHash === "google") {
        updateData.passwordHash = "firebase";
      }
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: { preferences: true },
        });
      }
    }

    await createSession(user.id);

    const needsOnboarding = isNewUser || !user.preferences?.onboardedAt;

    return NextResponse.json({
      ok: true,
      isNewUser: needsOnboarding,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error("SESSION ROUTE FATAL ERROR:", error);
    const message = error instanceof Error ? error.message : "Не удалось создать сессию в базе данных";
    return jsonError(message, 500);
  }
}
