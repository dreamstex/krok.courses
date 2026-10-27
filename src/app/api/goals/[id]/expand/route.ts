import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { jsonError, requireUser } from "@/lib/api";
import { getLocale } from "@/lib/i18n-server";
import { askKrokki } from "@/lib/ai/krokki";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { id } = await props.params;
  const locale = await getLocale();

  const plan = await prisma.learningPlan.findFirst({
    where: { id, userId: user.id },
    include: {
      skills: {
        include: { tasks: true },
      },
    },
  });
  if (!plan) return jsonError("Мэта не знойдзена.", 404);

  const skill = plan.skills[0];
  if (!skill) return jsonError("Навык мэты не знойдзены.", 404);

  const message = `Складзі яшчэ 4 новыя практычныя заданні па тэме: "${plan.title}". Не паўтарай старыя заданні.`;
  const result = await askKrokki(message, [], locale);

  const newTasks = result.goal?.tasks ?? [];
  const existingCount = skill.tasks.length;

  const createdTasks = [];
  for (let i = 0; i < newTasks.length; i++) {
    const t = newTasks[i];
    const created = await prisma.task.create({
      data: {
        id: `task-${plan.id.slice(-6)}-${existingCount + i + 1}`,
        skillId: skill.id,
        type: t.type,
        level: "base",
        prompt: t.prompt,
        options: t.options ?? [],
        answers: t.answers,
        explanation: t.explanation,
        explanationRu: t.explanationRu,
        source: "ai",
        isDiagnostic: false,
        active: true,
      },
    });
    createdTasks.push({
      id: created.id,
      type: created.type,
      prompt: created.prompt,
      options: (created.options as string[]) ?? [],
      answers: (created.answers as string[]) ?? [],
      explanation: created.explanation,
      explanationRu: created.explanationRu,
    });
  }

  return NextResponse.json({
    ok: true,
    addedCount: createdTasks.length,
    tasks: createdTasks,
  });
}
