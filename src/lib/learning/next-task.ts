import { prisma } from "@/lib/db/prisma";
import {
  pickFromTop,
  rankSkills,
  type SkillCategory,
  type UserGoal,
} from "@/lib/adaptive/next-step";
import { calculateForgettingScore } from "@/lib/adaptive/forgetting";
import { toTaskView, toPublicTask, type PublicTask } from "./task-view";
import { loadSkillProgress, type SkillProgress } from "./skill-state";
import { t, type Locale } from "@/lib/i18n";
import { expandPlanSkill } from "./expand-plan";

export function pickTaskForSkill<
  T extends { id: string; attempts: { id: string; isCorrect?: boolean }[] },
>(rows: T[], lastTaskId: string | null): T {
  const others = rows.filter((row) => row.id !== lastTaskId);
  const pool = others.length > 0 ? others : rows;
  return pool
    .map((row) => ({
      row,
      solved: row.attempts.some((a) => a.isCorrect === true) ? 1 : 0,
      seen: row.attempts.length,
    }))
    .sort(
      (a, b) =>
          a.solved - b.solved ||
          a.seen - b.seen ||
          a.row.id.localeCompare(b.row.id),
    )[0].row;
}


export interface RankedSkill {
  skillId: string;
  titleBe: string;
  moduleTitle: string;
  theory: string;
  mastery: number;
  attempts: number;
  practiceAttempts: number;
  solvedTasks: number;
  totalTasks: number;
  errorCount: number;
  order: number;
  score: number;
  reason: string;
}

export interface NextStep {
  task: PublicTask;
  skillId: string;
  skillTitle: string;
  moduleTitle: string;
  theory: string;
  mastery: number;
  solvedTasksInSkill: number;
  totalTasksInSkill: number;
  topicCompleted: boolean;
  score: number;
  reason: string;
}

export function explainReason(skill: SkillProgress, now: Date, locale: Locale = "be"): string {
  if (skill.attempts === 0) return t(locale, "reason.new");
  if (skill.correctStreak === 0 && skill.errorCount > 0) return t(locale, "reason.mistake");
  const forgetting = calculateForgettingScore(skill.lastSeenAt, skill.correctStreak, now);
  if (forgetting >= 1) return t(locale, "reason.review");
  return t(locale, "reason.weak");
}

async function getUserGoal(userId: string): Promise<UserGoal> {
  const prefs = await prisma.userPreference.findUnique({ where: { userId } });
  const focus = (prefs?.focusPreference ?? "balanced") as UserGoal["focus"];
  return { focus };
}


export async function getRankedSkills(userId: string, now = new Date(), locale: Locale = "be"): Promise<RankedSkill[]> {
  const [progress, goal] = await Promise.all([loadSkillProgress(userId), getUserGoal(userId)]);
  const byId = new Map(progress.map((skill) => [skill.skillId, skill]));

  return rankSkills(
    progress.map((skill) => ({
      skillId: skill.skillId,
      category: skill.category as SkillCategory,
      mastery: skill.mastery,
      attempts: skill.attempts,
      correctStreak: skill.correctStreak,
      lastSeenAt: skill.lastSeenAt,
    })),
    goal,
    now,
  )
    .map((ranked) => {
      const skill = byId.get(ranked.skillId)!;
      return {
        skillId: ranked.skillId,
        titleBe: locale === "ru" ? skill.titleRu ?? skill.titleBe : skill.titleBe,
        moduleTitle: (locale === "ru" ? skill.moduleTitleRu : skill.moduleTitleBe) ?? "Модуль",
        theory: (locale === "ru" ? skill.theoryRu : skill.theoryBe) ?? "",
        mastery: skill.mastery,
        attempts: skill.attempts,
        practiceAttempts: skill.practiceAttempts ?? 0,
        solvedTasks: skill.solvedTasks ?? 0,
        totalTasks: skill.totalTasks ?? 6,
        errorCount: skill.errorCount,
        order: skill.order ?? 99,
        score: ranked.score,
        reason: explainReason(skill, now, locale),
      };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order || a.skillId.localeCompare(b.skillId));
}

// если я сюда после каникул вернусь я с ума сойду, вот эти запросы ниже это выбор следующего шага по krok score, на всякий случай. реализовано замечательно, работает, трогать не надо
export async function getNextTask(
  userId: string,
  now = new Date(),
  locale: Locale = "be",
  requestedSkillId?: string | null,
): Promise<NextStep | null> {
  const [rankedAll, attemptCount, activePlan] = await Promise.all([
    getRankedSkills(userId, now, locale),
    prisma.taskAttempt.count({ where: { userId } }),
    prisma.learningPlan.findFirst({
      where: { userId, status: "active", skills: { some: {} } },
      select: { id: true, goalText: true, content: true },
    }),
  ]);
  let ranked = rankedAll;
  if (activePlan?.content && typeof activePlan.content === "object" && !Array.isArray(activePlan.content)) {
    const completed = activePlan.content.completedSkillIds;
    if (Array.isArray(completed)) ranked = ranked.filter((skill) => !completed.includes(skill.skillId));
  }

  let adaptivePool = ranked;
  if (!requestedSkillId) {
    const unmastered = ranked.filter((s) => s.solvedTasks < s.totalTasks && s.mastery < 1);
    if (unmastered.length > 0) {
      adaptivePool = unmastered;
    }
  }

  const chosen = requestedSkillId
    ? ranked.find((s) => s.skillId === requestedSkillId) ?? adaptivePool[0] ?? pickFromTop(adaptivePool, attemptCount, 3)
    : adaptivePool[0] ?? pickFromTop(adaptivePool, attemptCount, 3);
  if (!chosen) return null;

  let rows = await prisma.task.findMany({
    where: { skillId: chosen.skillId, active: true, isDiagnostic: false },
    include: { attempts: { where: { userId }, select: { id: true, isCorrect: true } } },
  });
  if (rows.length === 0) return null;

  if (rows.every((row) => row.attempts.length > 0)) {
    const expansion = await expandPlanSkill(userId, chosen.skillId);
    if (expansion === "added") {
      rows = await prisma.task.findMany({
        where: { skillId: chosen.skillId, active: true, isDiagnostic: false },
        include: { attempts: { where: { userId }, select: { id: true, isCorrect: true } } },
      });
    }
  }

  const lastAttempt = await prisma.taskAttempt.findFirst({
    where: { userId, task: { skillId: chosen.skillId } },
    orderBy: { createdAt: "desc" },
    select: { taskId: true },
  });

  const best = pickTaskForSkill(rows, lastAttempt?.taskId ?? null);
  const solvedTasksInSkill = rows.filter((row) => row.attempts.some((a) => a.isCorrect === true)).length;
  const totalTasksInSkill = rows.length;
  const topicCompleted = totalTasksInSkill > 0 && solvedTasksInSkill >= totalTasksInSkill;
  const progressMastery = totalTasksInSkill > 0 ? Math.round((solvedTasksInSkill / totalTasksInSkill) * 100) / 100 : 0;

  return {
    task: toPublicTask(toTaskView(best)),
    skillId: chosen.skillId,
    skillTitle: chosen.titleBe,
    moduleTitle: chosen.moduleTitle,
    theory: chosen.theory,
    mastery: topicCompleted ? 1 : progressMastery,
    solvedTasksInSkill,
    totalTasksInSkill,
    topicCompleted,
    score: chosen.score,
    reason: chosen.reason,
  };
}

