import { prisma } from "@/lib/db/prisma";
import { clampMastery, getMasteryDelta, updateSkillMastery } from "@/lib/adaptive/mastery";
import { DEFAULT_MASTERY } from "./skill-state";
import type { TaskView } from "./task-view";

export interface AttemptOutcome {
  isCorrect: boolean;
  score: number | null;
  evaluated: boolean;
}

export interface RecordAttemptInput {
  userId: string;
  submissionId: string;
  task: TaskView;
  answer: string;
  usedHint: boolean;
  sessionId: string | null;
  testPhase: "pre" | null;
  outcome: AttemptOutcome;
}


export async function recordAttempt(input: RecordAttemptInput, now = new Date()): Promise<string> {
  const { userId, task, outcome } = input;

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.taskAttempt.create({
      data: {
        submissionId: input.submissionId,
        userId,
        taskId: task.id,
        sessionId: input.sessionId,
        answer: input.answer,
        isCorrect: outcome.isCorrect,
        score: outcome.score,
        evaluated: outcome.evaluated,
        usedHint: input.usedHint,
        testPhase: input.testPhase,
        masteryDelta: outcome.evaluated ? getMasteryDelta({ isCorrect: outcome.isCorrect, usedHint: input.usedHint }) : 0,
      },
    });

    if (!outcome.evaluated) return attempt.id;

    const current = await tx.userSkillState.findUnique({
      where: { userId_skillId: { userId, skillId: task.skillId } },
    });
    let mastery = updateSkillMastery(current?.mastery ?? DEFAULT_MASTERY, {
      isCorrect: outcome.isCorrect,
      usedHint: input.usedHint,
    });

    //мастери до 100% если решил вообще все задания в теме
    if (outcome.isCorrect && input.testPhase === null) {
      const skillTasks = await tx.task.findMany({
        where: { skillId: task.skillId, active: true, isDiagnostic: false },
        select: {
          id: true,
          attempts: { where: { userId, isCorrect: true }, select: { id: true }, take: 1 },
        },
      });
      const totalTasks = skillTasks.length;
      if (totalTasks > 0) {
        const solvedTasks = skillTasks.filter((t) => t.attempts.length > 0).length;
        const solvedRatio = Math.round((solvedTasks / totalTasks) * 100) / 100;
        mastery = solvedTasks >= totalTasks ? 1 : clampMastery(Math.max(mastery, solvedRatio));
      }
    }

    await tx.userSkillState.upsert({
      where: { userId_skillId: { userId, skillId: task.skillId } },
      create: {
        userId,
        skillId: task.skillId,
        mastery,
        attempts: 1,
        correctAttempts: outcome.isCorrect ? 1 : 0,
        errorCount: outcome.isCorrect ? 0 : 1,
        streak: outcome.isCorrect ? 1 : 0,
        lastSeenAt: now,
        lastCorrectAt: outcome.isCorrect ? now : null,
      },
      update: {
        mastery,
        attempts: { increment: 1 },
        correctAttempts: outcome.isCorrect ? { increment: 1 } : undefined,
        errorCount: outcome.isCorrect ? undefined : { increment: 1 },
        streak: outcome.isCorrect ? { increment: 1 } : 0,
        lastSeenAt: now,
        lastCorrectAt: outcome.isCorrect ? now : undefined,
      },
    });

    if (!outcome.isCorrect) {
      await tx.learningError.create({
        data: {
          userId,
          attemptId: attempt.id,
          taskId: task.id,
          skillId: task.skillId,
          category: errorCategory(task.type),
        },
      });
    }
    return attempt.id;
  });
}

function errorCategory(type: TaskView["type"]): string {
  switch (type) {
    case "choice":
      return "wrong-choice";
    case "fill":
      return "wrong-form";
    case "correction":
      return "not-corrected";
    case "free-text":
      return "free-text";
  }
}
