import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { jsonError, requireUser } from "@/lib/api";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { id } = await props.params;

  const plan = await prisma.learningPlan.findFirst({
    where: { id, userId: user.id },
  });
  if (!plan) return jsonError("Мэта не знойдзена.", 404);

  const body = await request.json().catch(() => ({}));
  const score = typeof body.score === "number" ? Math.max(0, body.score) : undefined;
  const maxScore = typeof body.maxScore === "number" ? Math.max(0, body.maxScore) : undefined;

  await prisma.learningPlan.update({
    where: { id },
    data: {
      status: "completed",
      score,
      maxScore,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, score, maxScore });
}
