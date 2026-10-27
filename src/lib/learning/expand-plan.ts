import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createMoreTasks } from "@/lib/ai/goal-planner";
import { askAiWithSearch } from "@/lib/ai/deepseek";
import { reserveAiCall } from "@/lib/ai/rate-limit";
import { toTaskView } from "./task-view";
import { isMetroStationsGoal } from "./goal-scope";

type ExpansionResult = "added" | "complete" | "unavailable" | "not-needed";

function getReferenceNotes(content: Prisma.JsonValue): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const value = content.referenceNotes;
  return typeof value === "string" ? value : null;
}

function withReferenceNotes(content: Prisma.JsonValue, referenceNotes: string): Prisma.InputJsonValue {
  const current = content && typeof content === "object" && !Array.isArray(content) ? content : {};
  return { ...current, referenceNotes } as Prisma.InputJsonValue;
}

function withCompletedSkill(content: Prisma.JsonValue, skillId: string, referenceNotes?: string): Prisma.InputJsonValue {
  const current = content && typeof content === "object" && !Array.isArray(content) ? content : {};
  const previous = Array.isArray(current.completedSkillIds)
    ? current.completedSkillIds.filter((value): value is string => typeof value === "string")
    : [];
  return {
    ...current,
    ...(referenceNotes ? { referenceNotes } : {}),
    completedSkillIds: [...new Set([...previous, skillId])],
  } as Prisma.InputJsonValue;
}

function readSources(value: unknown): { title: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const title = item.title;
    const url = item.url;
    return typeof title === "string" && typeof url === "string" ? [{ title, url }] : [];
  });
}

export async function expandPlanSkill(userId: string, skillId: string): Promise<ExpansionResult> {
  const skill = await prisma.skill.findFirst({
    where: { id: skillId, plan: { userId, status: "active" } },
    include: {
      plan: true,
      tasks: {
        where: { active: true, isDiagnostic: false },
        include: { attempts: { where: { userId }, select: { id: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!skill?.plan || skill.tasks.length === 0) return "not-needed";
  if (skill.tasks.some((task) => task.attempts.length === 0)) return "not-needed";
  const activePlan = skill.plan;

  const content = activePlan.content as Prisma.JsonValue;
  if (content && typeof content === "object" && !Array.isArray(content) &&
      Array.isArray(content.completedSkillIds) && content.completedSkillIds.includes(skillId)) {
    return "complete";
  }

  const now = new Date();
  const cooldown = new Date(now.getTime() - 60_000);
  const claim = await prisma.learningPlan.updateMany({
    where: {
      id: activePlan.id,
      status: "active",
      OR: [{ lastTaskExpansionAt: null }, { lastTaskExpansionAt: { lt: cooldown } }],
    },
    data: { lastTaskExpansionAt: now },
  });
  if (claim.count === 0) return "unavailable";

  let referenceNotes = getReferenceNotes(content);
  let sources = readSources(activePlan.sources);

  if (!referenceNotes && isMetroStationsGoal(activePlan.goalText)) {
    try {
      const research = await askAiWithSearch(
        "Find the current list of stations of the Minsk metro with their correct Belarusian names. " +
        "Prefer the official Minsk Metro website or another primary source. Return the names as a compact list with source links. Do not add city signs or general vocabulary.",
      );
      if (research.ok) {
        const checkedSources = research.data.sources.filter((source) => {
          try {
            return ["https:", "http:"].includes(new URL(source.url).protocol);
          } catch {
            return false;
          }
        });
        if (checkedSources.length > 0) {
          referenceNotes = research.data.text.slice(0, 8000);
          sources = [...new Map([...sources, ...checkedSources].map((source) => [source.url, source])).values()];
        }
      }
    } catch (e) {
      console.warn("expand-plan: search grounding unavailable, continuing without external notes", e);
    }
  }

  if (!(await reserveAiCall(userId))) return "unavailable";
  const existing = skill.tasks.map((task) => {
    const view = toTaskView(task);
    return { prompt: view.prompt, answers: view.answers };
  });
  const result = await createMoreTasks(
    activePlan.goalText,
    skill.titleBe,
    skill.descriptionBe,
    existing,
    referenceNotes,
  );
  if (!result.ok) return "unavailable";

  const usedPrompts = new Set(existing.map((task) => task.prompt.trim().toLocaleLowerCase()));
  const usedAnswers = new Set(existing.flatMap((task) => task.answers.map((answer) => answer.trim().toLocaleLowerCase())));
  const uniqueTasks = result.data.tasks.filter((task) => {
    const prompt = task.prompt.trim().toLocaleLowerCase();
    if (usedPrompts.has(prompt)) return false;
    if (isMetroStationsGoal(activePlan.goalText) && task.answers.some((answer) => usedAnswers.has(answer.trim().toLocaleLowerCase()))) return false;
    usedPrompts.add(prompt);
    task.answers.forEach((answer) => usedAnswers.add(answer.trim().toLocaleLowerCase()));
    return true;
  });

  if (referenceNotes) {
    await prisma.learningPlan.update({
      where: { id: activePlan.id },
      data: {
        content: result.data.goalComplete && uniqueTasks.length === 0
          ? withCompletedSkill(content, skillId, referenceNotes)
          : withReferenceNotes(content, referenceNotes),
        sources: sources as Prisma.InputJsonValue,
      },
    });
  } else if (result.data.goalComplete && uniqueTasks.length === 0) {
    await prisma.learningPlan.update({
      where: { id: activePlan.id },
      data: { content: withCompletedSkill(content, skillId) },
    });
  }

  if (uniqueTasks.length === 0) return result.data.goalComplete ? "complete" : "unavailable";

  const level = skill.tasks[0]?.level ?? "base";
  await prisma.task.createMany({
    data: uniqueTasks.map((task) => ({
      id: `ai-${randomUUID()}`,
      skillId: skill.id,
      type: task.type,
      level,
      prompt: task.prompt,
      options: task.options as Prisma.InputJsonValue,
      answers: task.answers as Prisma.InputJsonValue,
      explanation: task.explanation,
      explanationRu: task.explanationRu,
      source: "ai",
      isDiagnostic: false,
    })),
  });
  return "added";
}
