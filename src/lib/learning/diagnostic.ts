import { prisma } from "@/lib/db/prisma";
import { SEED_TASKS } from "@/data/seed-tasks";
import { getSkillDefinition, SKILLS } from "@/data/skills";
import { gradeClosedTask, toPublicTask, toTaskView, type PublicTask, type TaskView } from "./task-view";

export const DIAGNOSTIC_TASK_IDS = [
  "diag-pronouns-01",
  "diag-gender-01",
  "diag-number-01",
  "diag-adjectives-01",
  "diag-negation-01",
  "diag-family-01",
  "diag-food-01",
  "diag-time-01",
  "diag-present-01",
  "diag-past-01",
  "diag-future-01",
  "diag-motion-01",
  "diag-genitive-01",
  "diag-dative-01",
  "diag-instrumental-01",
  "diag-prepositional-01",
  "diag-city-01",
  "diag-reading-01",
] as const;

export const DIAGNOSTIC_SKIP_VALUE = "__SKIP__";
export const DIAGNOSTIC_STRONG_MASTERY = 0.8;
export const DIAGNOSTIC_WEAK_MASTERY = 0.2;

export interface PublicDiagnosticTask extends PublicTask {
  skillId: string;
  skillTitleBe: string;
  skillTitleRu: string;
  moduleTitleBe: string;
  moduleTitleRu: string;
}

export interface DiagnosticSkillSummary {
  skillId: string;
  titleBe: string;
  titleRu: string;
  moduleTitleBe: string;
  moduleTitleRu: string;
}

export interface DiagnosticSummaryResult {
  alreadyDone: boolean;
  total: number;
  correct: number;
  weakSkills: DiagnosticSkillSummary[];
  strongSkills: DiagnosticSkillSummary[];
}

function getFallbackTasks(): TaskView[] {
  const byId = new Map(SEED_TASKS.map((t) => [t.id, t]));
  return DIAGNOSTIC_TASK_IDS.flatMap((id) => {
    const task = byId.get(id);
    if (!task) return [];
    return [
      {
        id: task.id,
        skillId: task.skillId,
        type: task.type,
        prompt: task.prompt,
        options: task.options ?? [],
        answers: task.answers ?? [],
        explanation: task.explanation ?? null,
        explanationRu: task.explanationRu ?? null,
      },
    ];
  });
}

export async function getDiagnosticTasks(userId: string): Promise<TaskView[]> {
  const plan = await prisma.learningPlan.findFirst({
    where: { userId, status: "active" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (plan) {
    const planTasks = await prisma.task.findMany({
      where: { isDiagnostic: true, skill: { planId: plan.id } },
      orderBy: { id: "asc" },
    });
    if (planTasks.length > 0) {
      return planTasks.map(toTaskView);
    }
  }

  return getFallbackTasks();
}

export function getPublicDiagnosticTasks(tasks: TaskView[]): PublicDiagnosticTask[] {
  return tasks.map((task) => {
    const pub = toPublicTask(task);
    const skillDef = getSkillDefinition(task.skillId);
    return {
      ...pub,
      skillId: task.skillId,
      skillTitleBe: skillDef?.titleBe ?? task.skillId,
      skillTitleRu: skillDef?.titleRu ?? skillDef?.titleBe ?? task.skillId,
      moduleTitleBe: skillDef?.moduleTitleBe ?? "Агульны модуль",
      moduleTitleRu: skillDef?.moduleTitleRu ?? "Общий модуль",
    };
  });
}

function mapFocusTopicToSkills(topic: string): string[] {
  switch (topic) {
    case "spelling":
      return ["grammar.pronouns", "grammar.negation", "writing.basic"];
    case "cases":
      return [
        "grammar.cases.nominative",
        "grammar.cases.genitive",
        "grammar.cases.dative",
        "grammar.cases.accusative",
        "grammar.cases.instrumental",
        "grammar.cases.prepositional",
      ];
    case "verbs":
      return ["grammar.present-tense", "grammar.past-tense", "grammar.future-tense", "grammar.motion-verbs"];
    case "syntax":
      return ["grammar.adjectives", "grammar.negation", "writing.basic"];
    case "family":
      return ["vocabulary.family", "vocabulary.emotions"];
    case "food":
      return ["vocabulary.food"];
    case "city":
      return ["vocabulary.city", "vocabulary.transport"];
    case "culture":
      return ["vocabulary.travel", "reading.basic", "reading.inference"];
    case "modern":
      return ["vocabulary.work", "vocabulary.education", "vocabulary.technology"];
    default:
      return [];
  }
}

function toSkillSummary(skillId: string): DiagnosticSkillSummary {
  const def = getSkillDefinition(skillId);
  return {
    skillId,
    titleBe: def?.titleBe ?? skillId,
    titleRu: def?.titleRu ?? def?.titleBe ?? skillId,
    moduleTitleBe: def?.moduleTitleBe ?? "Модуль",
    moduleTitleRu: def?.moduleTitleRu ?? "Модуль",
  };
}


export async function saveDiagnosticResult(
  userId: string,
  answers: Record<string, string>,
): Promise<DiagnosticSummaryResult> {
  const tasks = await getDiagnosticTasks(userId);
  const now = new Date();

  const bySkill = new Map<string, { mastery: number; isCorrect: boolean }>();
  const weakSkills: DiagnosticSkillSummary[] = [];
  const strongSkills: DiagnosticSkillSummary[] = [];
  let correctCount = 0;

  for (const task of tasks) {
    const raw = (answers[task.id] ?? "").trim();
    const isSkipped = !raw || raw === DIAGNOSTIC_SKIP_VALUE;
    const isCorrect = !isSkipped && gradeClosedTask(task, raw);
    if (isCorrect) correctCount++;

    bySkill.set(task.skillId, {
      mastery: isCorrect ? DIAGNOSTIC_STRONG_MASTERY : DIAGNOSTIC_WEAK_MASTERY,
      isCorrect,
    });

    if (isCorrect) {
      if (!strongSkills.some((s) => s.skillId === task.skillId)) {
        strongSkills.push(toSkillSummary(task.skillId));
      }
    } else {
      if (!weakSkills.some((s) => s.skillId === task.skillId)) {
        weakSkills.push(toSkillSummary(task.skillId));
      }
    }
  }

  // учитываем темы которые выбрал на онбординге даже если их не было в диагностике
  const prefs = await prisma.userPreference.findUnique({ where: { userId } });
  const focusTopics = Array.isArray(prefs?.focusTopics)
    ? prefs.focusTopics.filter((x): x is string => typeof x === "string")
    : [];
  for (const topic of focusTopics) {
    for (const focusSkillId of mapFocusTopicToSkills(topic)) {
      if (!bySkill.has(focusSkillId)) {
        bySkill.set(focusSkillId, { mastery: 0.25, isCorrect: false });
        if (!weakSkills.some((s) => s.skillId === focusSkillId)) {
          weakSkills.push(toSkillSummary(focusSkillId));
        }
      }
    }
  }

  if (weakSkills.length === 0) {
    for (const s of SKILLS.slice(0, 3)) {
      if (!bySkill.has(s.id)) {
        bySkill.set(s.id, { mastery: 0.35, isCorrect: false });
        weakSkills.push(toSkillSummary(s.id));
      }
    }
  }

  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.userPreference.updateMany({
      where: { userId, diagnosedAt: null },
      data: { diagnosedAt: now },
    });
    if (claim.count === 0) return false;

    for (const [skillId, result] of bySkill) {
      const skillExists = await tx.skill.findUnique({ where: { id: skillId }, select: { id: true } });
      if (!skillExists) continue;

      await tx.userSkillState.upsert({
        where: { userId_skillId: { userId, skillId } },
        create: {
          userId,
          skillId,
          mastery: result.mastery,
          attempts: 1,
          correctAttempts: result.isCorrect ? 1 : 0,
          errorCount: result.isCorrect ? 0 : 1,
          streak: result.isCorrect ? 2 : 0,
          lastSeenAt: now,
          lastCorrectAt: result.isCorrect ? now : null,
        },
        update: {
          mastery: result.mastery,
          attempts: 1,
          correctAttempts: result.isCorrect ? 1 : 0,
          errorCount: result.isCorrect ? 0 : 1,
          streak: result.isCorrect ? 2 : 0,
          lastSeenAt: now,
          lastCorrectAt: result.isCorrect ? now : null,
        },
      });
    }
    return true;
  });

  if (!claimed) {
    return {
      alreadyDone: true,
      total: tasks.length,
      correct: correctCount,
      weakSkills,
      strongSkills,
    };
  }

  return {
    alreadyDone: false,
    total: tasks.length,
    correct: correctCount,
    weakSkills,
    strongSkills,
  };
}
