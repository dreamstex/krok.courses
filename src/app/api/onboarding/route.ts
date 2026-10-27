import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { onboardingSchema } from "@/lib/validation/schemas";
import { jsonError, requireUser } from "@/lib/api";

const BEGINNER_STARTER_SKILLS = [
  "grammar.pronouns",
  "grammar.gender",
  "vocabulary.family",
  "vocabulary.food",
  "grammar.present-tense",
] as const;

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const parsed = onboardingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Праверце адказы.", 400);

  const { knowledgeLevel, interestArea, speakingContext, focusTopics, minutesPerDay } = parsed.data;
  const now = new Date();
  const isBeginner = knowledgeLevel === "none";

  const focusPreference =
    interestArea === "speaking"
      ? "free"
      : interestArea === "grammar"
        ? "grammar"
        : interestArea === "vocabulary"
          ? "vocabulary"
          : "balanced";

  await prisma.$transaction(async (tx) => {
    await tx.userPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        knowledgeLevel,
        interestArea,
        speakingContext: speakingContext ?? null,
        focusTopics: focusTopics ?? [],
        minutesPerDay,
        goal: interestArea,
        focusPreference,
        onboardedAt: now,
        diagnosedAt: isBeginner ? now : null,
      },
      update: {
        knowledgeLevel,
        interestArea,
        speakingContext: speakingContext ?? null,
        focusTopics: focusTopics ?? [],
        minutesPerDay,
        goal: interestArea,
        focusPreference,
        onboardedAt: now,
        diagnosedAt: isBeginner ? now : null,
      },
    });

    await tx.learningPlan.deleteMany({
      where: { userId: user.id, skills: { none: {} } },
    });

    // если выбрал с нуля, кидаем стартовые навыки, не мучить диагностикой
    if (isBeginner) {
      for (const skillId of BEGINNER_STARTER_SKILLS) {
        const exists = await tx.skill.findUnique({ where: { id: skillId }, select: { id: true } });
        if (!exists) continue;
        await tx.userSkillState.upsert({
          where: { userId_skillId: { userId: user.id, skillId } },
          create: {
            userId: user.id,
            skillId,
            mastery: 0.2,
            attempts: 1,
            correctAttempts: 0,
            errorCount: 1,
            streak: 0,
            lastSeenAt: now,
            lastCorrectAt: null,
          },
          update: {},
        });
      }
    }
  });

  return NextResponse.json({
    ok: true,
    redirectTo: isBeginner ? "/dashboard" : "/diagnostic",
  });
}
