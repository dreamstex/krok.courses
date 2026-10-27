import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { answerSchema, FREE_TEXT_MIN } from "@/lib/validation/schemas";
import { jsonError, requireUser } from "@/lib/api";
import { toTaskView, gradeClosedTask, FREE_TEXT_PASS_SCORE } from "@/lib/learning/task-view";
import { recordAttempt } from "@/lib/learning/record-attempt";
import { getOrCreateSession } from "@/lib/learning/sessions";
import { evaluateFreeText, explainMistake } from "@/lib/ai/ai-actions";
import { reserveAiCall } from "@/lib/ai/rate-limit";
import { Prisma } from "@prisma/client";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

async function recordAttemptSafely(input: Parameters<typeof recordAttempt>[0]): Promise<{ created: true; id: string } | { created: false; id: string }> {
  try {
    const id = await recordAttempt(input);
    return { created: true, id };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    const existing = await prisma.taskAttempt.findUniqueOrThrow({
      where: { submissionId: input.submissionId },
      select: { id: true },
    });
    return { created: false, id: existing.id };
  }
}

async function duplicateResponse(attemptId: string) {
  const stored = await prisma.taskAttempt.findUnique({
    where: { id: attemptId },
    select: { isCorrect: true, evaluated: true },
  });
  return NextResponse.json({
    isCorrect: stored?.evaluated ? stored.isCorrect : null,
    explanation: null,
    attemptId,
    evaluated: stored?.evaluated ?? false,
    duplicate: true,
  });
}


export async function POST(request: Request) {
  const locale = await getLocale();
  const { user, response } = await requireUser();
  if (!user) return response;

  const parsed = answerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(t(locale, "attempt.bad"), 400);
  const { submissionId, taskId, answer, usedHint } = parsed.data;

  const existing = await prisma.taskAttempt.findUnique({
    where: { submissionId },
    select: { id: true, userId: true, isCorrect: true, evaluated: true, answer: true },
  });
  if (existing) {
    if (existing.userId !== user.id) return jsonError(t(locale, "attempt.duplicate"), 409);
    return duplicateResponse(existing.id);
  }

  const row = await prisma.task.findFirst({ where: { id: taskId, active: true } });
  if (!row) return jsonError(t(locale, "attempt.missingTask"), 404);
  const task = toTaskView(row);

  const sessionId = await getOrCreateSession(user.id);


  if (task.type !== "free-text" || task.answers.length > 0) {
    if (!answer) return jsonError(t(locale, "attempt.empty"), 400);
    let isCorrect = gradeClosedTask(task, answer);
    let explanation =
      locale === "ru"
        ? task.explanationRu ?? task.explanation ?? t(locale, "practice.aiFallback", { answer: task.answers[0] ?? "—" })
        : task.explanation;

    let aiResult: Awaited<ReturnType<typeof explainMistake>> | null = null;

    if (!isCorrect && (await reserveAiCall(user.id))) {
      const referenceAnswer = task.answers.join(" / ");
      const ai = await explainMistake(task.skillId, task.prompt, answer, referenceAnswer, locale);
      if (ai.ok) {
        aiResult = ai;
        explanation = [ai.data.explanation, ...ai.data.examples].join("\n");
        //здесь если нормальный белорусский вариант которого не было в массиве ответов то засчитываем
        if (task.type !== "choice" && ai.data.isActuallyCorrect === true) {
          isCorrect = true;
        }
      }
    }

    const attemptId = await recordAttemptSafely({
      submissionId,
      userId: user.id,
      task,
      answer,
      usedHint,
      sessionId,
      testPhase: null,
      outcome: { isCorrect, score: null, evaluated: true },
    });
    if (!attemptId.created) return await duplicateResponse(attemptId.id);

    if (aiResult && aiResult.ok) {
      await prisma.aiEvaluation.create({
        data: { userId: user.id, attemptId: attemptId.id, kind: "explain", result: aiResult.data, model: aiResult.model },
      });
    }

    const skillTasks = await prisma.task.findMany({
      where: { skillId: task.skillId, active: true, isDiagnostic: false },
      select: {
        id: true,
        attempts: { where: { userId: user.id, isCorrect: true }, select: { id: true }, take: 1 },
      },
    });

    const totalTasksInSkill = skillTasks.length;
    const solvedTasksInSkill = skillTasks.filter((tRow) => tRow.attempts.length > 0).length;
    const topicCompleted = totalTasksInSkill > 0 && solvedTasksInSkill >= totalTasksInSkill;
    const progressMastery = totalTasksInSkill > 0 ? Math.round((solvedTasksInSkill / totalTasksInSkill) * 100) / 100 : 0;

    return NextResponse.json({
      isCorrect,
      explanation,
      attemptId: attemptId.id,
      skillProgress: {
        skillId: task.skillId,
        mastery: topicCompleted ? 1 : progressMastery,
        solvedTasksInSkill,
        totalTasksInSkill,
        topicCompleted,
      },
    });
  }

  if (answer.length < FREE_TEXT_MIN) return jsonError(t(locale, "attempt.short"), 400);

  const slot = await reserveAiCall(user.id);
  const ai = slot ? await evaluateFreeText(answer, task.skillId, locale) : { ok: false as const, reason: "budget" };
  if (!ai.ok) {
    const saved = await recordAttemptSafely({
      submissionId,
      userId: user.id,
      task,
      answer,
      usedHint,
      sessionId,
      testPhase: null,
      outcome: { isCorrect: false, score: null, evaluated: false },
    });
    if (!saved.created) return await duplicateResponse(saved.id);
    return NextResponse.json({ isCorrect: null, explanation: t(locale, "practice.saved"), attemptId: saved.id, evaluated: false });
  }

  const isCorrect = ai.data.score >= FREE_TEXT_PASS_SCORE;
  const saved = await recordAttemptSafely({
    submissionId,
    userId: user.id,
    task,
    answer,
    usedHint,
    sessionId,
    testPhase: null,
    outcome: { isCorrect, score: ai.data.score, evaluated: true },
  });
  if (!saved.created) return await duplicateResponse(saved.id);
  await prisma.aiEvaluation.create({
    data: { userId: user.id, attemptId: saved.id, kind: "free-text", result: ai.data, model: ai.model },
  });
  return NextResponse.json({ isCorrect, explanation: ai.data.feedback, attemptId: saved.id, evaluated: true });
}
