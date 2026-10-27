import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { jsonError, requireUser } from "@/lib/api";
import { getLocale } from "@/lib/i18n-server";
import { askKrokki, type UserTestContext } from "@/lib/ai/krokki";
import { getSkillDefinition } from "@/data/skills";
import { z } from "zod";

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(1500),
  sessionId: z.string().cuid().optional().nullable(),
  testId: z.string().optional().nullable(),
  topicSkillId: z.string().max(100).optional().nullable(),
  theoryPlanId: z.string().max(100).optional().nullable(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2500),
      }),
    )
    .max(12)
    .default([]),
});

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (sessionId) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) {
      return NextResponse.json({ messages: [], session: null });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { userId: user.id, sessionId },
      orderBy: { createdAt: "asc" },
      take: 60,
    });

    const planIds = messages
      .map((m) => m.planId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const planMap = new Map<string, { goalTitle: string; tasksCount: number }>();
    if (planIds.length > 0) {
      const locale = await getLocale();
      const plans = await prisma.learningPlan.findMany({
        where: { id: { in: planIds }, userId: user.id },
        include: {
          skills: {
            include: {
              _count: {
                select: { tasks: true },
              },
            },
          },
        },
      });

      for (const p of plans) {
        const goalTitle = locale === "ru" && p.titleRu ? p.titleRu : p.title;
        const dbCount = p.skills.reduce((sum, s) => sum + s._count.tasks, 0);
        const contentTasks =
          p.content && typeof p.content === "object" && Array.isArray((p.content as { tasks?: unknown[] }).tasks)
            ? (p.content as { tasks: unknown[] }).tasks.length
            : 0;
        const tasksCount = dbCount > 0 ? dbCount : contentTasks;
        planMap.set(p.id, { goalTitle, tasksCount });
      }
    }

    const enrichedMessages = messages.map((m) => {
      if (!m.planId) return m;
      const planInfo = planMap.get(m.planId);
      if (!planInfo) return m;
      return {
        ...m,
        goalTitle: planInfo.goalTitle,
        tasksCount: planInfo.tasksCount,
      };
    });

    return NextResponse.json({ messages: enrichedMessages, session });
  }

  const totalSessions = await prisma.chatSession.count({ where: { userId: user.id } });
  if (totalSessions === 0) {
    const legacyCount = await prisma.chatMessage.count({
      where: { userId: user.id, sessionId: null },
    });
    if (legacyCount > 0) {
      const legacySession = await prisma.chatSession.create({
        data: {
          userId: user.id,
          title: "Папярэдні дыялог",
        },
      });
      await prisma.chatMessage.updateMany({
        where: { userId: user.id, sessionId: null },
        data: { sessionId: legacySession.id },
      });
      return NextResponse.json({ messages: [], session: null });
    }
  }

  return NextResponse.json({ messages: [], session: null });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const locale = await getLocale();
  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Увядзіце паведамленне.", 400);

  const {
    message,
    sessionId: incomingSessionId,
    testId,
    topicSkillId,
    theoryPlanId,
    history,
  } = parsed.data;

  let topicTheoryContext: UserTestContext["topicTheoryContext"] | undefined;
  if (topicSkillId) {
    const skillDef = getSkillDefinition(topicSkillId);
    if (skillDef) {
      topicTheoryContext = {
        title: locale === "ru" ? skillDef.titleRu : skillDef.titleBe,
        theory: locale === "ru" ? skillDef.theoryRu : skillDef.theoryBe,
      };
    } else {
      const dbSkill = await prisma.skill.findUnique({ where: { id: topicSkillId } });
      if (dbSkill) {
        topicTheoryContext = {
          title: locale === "ru" ? dbSkill.titleRu ?? dbSkill.titleBe : dbSkill.titleBe,
          theory: locale === "ru" ? dbSkill.descriptionRu ?? dbSkill.descriptionBe : dbSkill.descriptionBe,
        };
      }
    }
  } else if (theoryPlanId) {
    const planForTheory = await prisma.learningPlan.findFirst({
      where: { id: theoryPlanId, userId: user.id },
    });
    if (planForTheory) {
      const contentObj =
        planForTheory.content && typeof planForTheory.content === "object" && !Array.isArray(planForTheory.content)
          ? (planForTheory.content as Record<string, unknown>)
          : {};
      const theoryBe = typeof contentObj.theoryBe === "string" ? contentObj.theoryBe : planForTheory.summary;
      const theoryRu = typeof contentObj.theoryRu === "string" ? contentObj.theoryRu : planForTheory.summaryRu ?? planForTheory.summary;
      topicTheoryContext = {
        title: locale === "ru" ? planForTheory.titleRu ?? planForTheory.title : planForTheory.title,
        theory: locale === "ru" ? theoryRu : theoryBe,
      };
    }
  }

  let activeSessionId = incomingSessionId ?? null;
  if (activeSessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: { id: activeSessionId, userId: user.id },
    });
    if (!existing) activeSessionId = null;
  }

  if (!activeSessionId) {
    let sessionTitle = "Новы дыялог";
    if (topicTheoryContext) {
      sessionTitle = (locale === "ru" ? `Теория: ${topicTheoryContext.title}` : `Тэорыя: ${topicTheoryContext.title}`).slice(0, 60);
    } else if (testId) {
      const testPlan = await prisma.learningPlan.findFirst({
        where: { id: testId, userId: user.id },
        select: { title: true, titleRu: true },
      });
      if (testPlan) {
        const baseTitle = locale === "ru" && testPlan.titleRu ? testPlan.titleRu : testPlan.title;
        sessionTitle = `Разбор: ${baseTitle}`;
      }
    } else {
      sessionTitle = message.length > 38 ? message.slice(0, 38) + "…" : message;
    }

    const createdSession = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title: sessionTitle,
      },
    });
    activeSessionId = createdSession.id;
  }

  await prisma.chatMessage.create({
    data: {
      userId: user.id,
      sessionId: activeSessionId,
      role: "user",
      content: message,
    },
  });

  // собираем контекст последнего теста чтоб крокки понимал про какие ошибки его спрашивают
  let userContext: UserTestContext = {
    ...(topicTheoryContext ? { topicTheoryContext } : {}),
  };

  if (testId) {
    const plan = await prisma.learningPlan.findFirst({
      where: { id: testId, userId: user.id },
      include: {
        skills: {
          include: {
            tasks: {
              include: {
                attempts: {
                  where: { userId: user.id },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (plan) {
      const allTasks = plan.skills.flatMap((s) => s.tasks);
      const totalAttempts = allTasks.length;
      const correctAttempts = allTasks.filter((t) => t.attempts[0]?.isCorrect === true).length;
      const scorePercent = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

      const errors = allTasks
        .filter((t) => t.attempts[0] && !t.attempts[0].isCorrect)
        .map((t) => ({
          prompt: t.prompt,
          userAnswer: t.attempts[0]?.answer ?? "",
          correctAnswers: (t.answers as string[]) ?? [],
          explanation: (locale === "ru" && t.explanationRu ? t.explanationRu : t.explanation) ?? undefined,
        }));

      userContext = {
        ...userContext,
        lastTestTitle: (locale === "ru" && plan.titleRu ? plan.titleRu : plan.title) ?? undefined,
        totalAttempts,
        correctAttempts,
        scorePercent,
        recentErrors: errors,
      };

      if (!plan.chatSessionId) {
        await prisma.learningPlan.update({
          where: { id: plan.id },
          data: { chatSessionId: activeSessionId },
        });
      }
    }
  } else if (!topicTheoryContext) {
    const sessionPlan = await prisma.learningPlan.findFirst({
      where: { userId: user.id, chatSessionId: activeSessionId },
      orderBy: { createdAt: "desc" },
    });

    if (sessionPlan) {
      const recentAttempts = await prisma.taskAttempt.findMany({
        where: { userId: user.id, task: { skill: { planId: sessionPlan.id } } },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { task: true },
      });

      if (recentAttempts.length > 0) {
        const totalAttempts = recentAttempts.length;
        const correctAttempts = recentAttempts.filter((a) => a.isCorrect).length;
        const scorePercent = Math.round((correctAttempts / totalAttempts) * 100);
        const errors = recentAttempts
          .filter((a) => !a.isCorrect && a.task)
          .map((a) => ({
            prompt: a.task.prompt,
            userAnswer: a.answer,
            correctAnswers: (a.task.answers as string[]) ?? [],
            explanation: (locale === "ru" && a.task.explanationRu ? a.task.explanationRu : a.task.explanation) ?? undefined,
          }));

        userContext = {
          ...userContext,
          lastTestTitle: (locale === "ru" && sessionPlan.titleRu ? sessionPlan.titleRu : sessionPlan.title) ?? undefined,
          totalAttempts,
          correctAttempts,
          scorePercent,
          recentErrors: errors,
        };
      }
    }
  }

  const sessionHistory = history.slice(-6);
  const result = await askKrokki(message, sessionHistory, locale, userContext);

  let planId: string | null = null;
  let goalTitle: string | null = null;
  let tasksCount = 0;

  if (result.goal) {
    const goal = result.goal;
    tasksCount = goal.tasks.length;
    goalTitle = locale === "ru" ? goal.titleRu : goal.titleBe;

    const plan = await prisma.learningPlan.create({
      data: {
        userId: user.id,
        chatSessionId: activeSessionId,
        title: goal.titleBe,
        titleRu: goal.titleRu,
        goalText: message,
        summary: goal.descriptionBe,
        summaryRu: goal.descriptionBe,
        dailyMinutes: 10,
        content: goal,
        status: "active",
      },
    });

    planId = plan.id;

    const skillId = `krokki.${plan.id.slice(-8)}`;
    const skill = await prisma.skill.create({
      data: {
        id: skillId,
        planId: plan.id,
        category: goal.category,
        titleBe: goal.titleBe,
        titleRu: goal.titleRu,
        descriptionBe: goal.theoryBe ?? goal.descriptionBe,
        descriptionRu: goal.theoryRu ?? goal.descriptionBe,
      },
    });

    for (let i = 0; i < goal.tasks.length; i++) {
      const task = goal.tasks[i];
      await prisma.task.create({
        data: {
          id: `task-${plan.id.slice(-6)}-${i + 1}`,
          skillId: skill.id,
          type: task.type,
          level: "base",
          prompt: task.prompt,
          options: task.options ?? [],
          answers: task.answers,
          explanation: task.explanation,
          explanationRu: task.explanationRu,
          source: "ai",
          isDiagnostic: false,
          active: true,
        },
      });
    }
  }

  await prisma.chatMessage.create({
    data: {
      userId: user.id,
      sessionId: activeSessionId,
      role: "assistant",
      content: result.reply,
      planId,
    },
  });

  await prisma.chatSession.update({
    where: { id: activeSessionId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    reply: result.reply,
    planId,
    goalTitle,
    tasksCount,
    sessionId: activeSessionId,
  });
}
