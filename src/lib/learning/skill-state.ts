import { prisma } from "@/lib/db/prisma";
import { getSkillDefinition } from "@/data/skills";
import { isMetroStationsGoal } from "./goal-scope";

export const DEFAULT_MASTERY = 0.2;

export interface SkillProgress {
  skillId: string;
  titleBe: string;
  titleRu?: string | null;
  moduleId?: string;
  moduleTitleBe?: string;
  moduleTitleRu?: string;
  order?: number;
  theoryBe?: string;
  theoryRu?: string;
  category: string;
  mastery: number;
  attempts: number;
  practiceAttempts?: number;
  solvedTasks?: number;
  totalTasks?: number;
  errorCount: number;
  correctStreak: number;
  lastSeenAt: Date | null;
}

export async function loadSkillProgress(userId: string): Promise<SkillProgress[]> {
  const activePlan = await prisma.learningPlan.findFirst({
    where: { userId, status: "active", skills: { some: {} } },
    select: { id: true, goalText: true },
    orderBy: { createdAt: "desc" },
  });
  const skillWhere = activePlan ? { OR: [{ planId: activePlan.id }, { planId: null }] } : { planId: null };
  const [allSkills, states, practiceTasks] = await Promise.all([
    prisma.skill.findMany({ where: skillWhere, orderBy: { id: "asc" } }),
    prisma.userSkillState.findMany({ where: { userId, skill: skillWhere } }),
    prisma.task.findMany({
      where: { active: true, isDiagnostic: false, skill: skillWhere },
      select: {
        id: true,
        skillId: true,
        attempts: {
          where: { userId },
          select: { isCorrect: true },
        },
      },
    }),
  ]);
  const skills = activePlan && isMetroStationsGoal(activePlan.goalText)
    ? allSkills.filter((skill) => /(метро|станц)/i.test(`${skill.titleBe} ${skill.descriptionBe}`))
    : allSkills;
  const stateBySkill = new Map(states.map((state) => [state.skillId, state]));

  const taskStatsBySkill = new Map<string, { totalTasks: number; solvedTasks: number; practiceAttempts: number }>();
  for (const task of practiceTasks) {
    const stat = taskStatsBySkill.get(task.skillId) ?? { totalTasks: 0, solvedTasks: 0, practiceAttempts: 0 };
    stat.totalTasks += 1;
    if (task.attempts.some((a) => a.isCorrect === true)) {
      stat.solvedTasks += 1;
    }
    stat.practiceAttempts += task.attempts.length;
    taskStatsBySkill.set(task.skillId, stat);
  }

  return skills
    .map((skill) => {
      const state = stateBySkill.get(skill.id);
      const def = getSkillDefinition(skill.id);
      const taskStat = taskStatsBySkill.get(skill.id) ?? { totalTasks: 0, solvedTasks: 0, practiceAttempts: 0 };
      const allSolved = taskStat.totalTasks > 0 && taskStat.solvedTasks >= taskStat.totalTasks;
      const rawMastery = state?.mastery ?? DEFAULT_MASTERY;
      return {
        skillId: skill.id,
        titleBe: skill.titleBe,
        titleRu: skill.titleRu ?? def?.titleRu ?? skill.titleBe,
        moduleId: def?.moduleId ?? "basics",
        moduleTitleBe: def?.moduleTitleBe ?? "Модуль",
        moduleTitleRu: def?.moduleTitleRu ?? "Модуль",
        order: def?.order ?? 99,
        theoryBe: def?.theoryBe ?? skill.descriptionBe,
        theoryRu: def?.theoryRu ?? skill.descriptionRu ?? skill.descriptionBe,
        category: skill.category,
        mastery: allSolved ? 1 : rawMastery,
        attempts: state?.attempts ?? 0,
        practiceAttempts: taskStat.practiceAttempts,
        solvedTasks: taskStat.solvedTasks,
        totalTasks: taskStat.totalTasks,
        errorCount: state?.errorCount ?? 0,
        correctStreak: state?.streak ?? 0,
        lastSeenAt: state?.lastSeenAt ?? null,
      };
    })
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.skillId.localeCompare(b.skillId));
}

export interface UserGameLevel {
  level: number;
  titleBe: string;
  titleRu: string;
  correctAnswers: number;
  currentLevelMin: number;
  nextLevelMin: number;
  progressPercent: number;
}

export function getUserGameLevel(totalCorrect: number): UserGameLevel {
  const levels = [
    { level: 1, min: 0, titleBe: "Пачатковец", titleRu: "Новичок" },
    { level: 2, min: 10, titleBe: "Шукальнік", titleRu: "Искатель" },
    { level: 3, min: 25, titleBe: "Знаўца", titleRu: "Знаток" },
    { level: 4, min: 50, titleBe: "Майстар", titleRu: "Мастер" },
    { level: 5, min: 100, titleBe: "Асветнік", titleRu: "Просветитель" },
    { level: 6, min: 200, titleBe: "Мовазнаўца", titleRu: "Языковед" },
  ];

  let current = levels[0];
  let next = levels[1];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalCorrect >= levels[i].min) {
      current = levels[i];
      next = levels[i + 1] ?? { level: current.level + 1, min: current.min + 100, titleBe: "Легенда", titleRu: "Легенда" };
      break;
    }
  }

  const range = Math.max(1, next.min - current.min);
  const progressInLevel = Math.max(0, totalCorrect - current.min);
  const progressPercent = Math.min(100, Math.round((progressInLevel / range) * 100));

  return {
    level: current.level,
    titleBe: current.titleBe,
    titleRu: current.titleRu,
    correctAnswers: totalCorrect,
    currentLevelMin: current.min,
    nextLevelMin: next.min,
    progressPercent,
  };
}
