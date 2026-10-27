import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { jsonError, requireUser } from "@/lib/api";

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { id } = await props.params;

  const session = await prisma.chatSession.findFirst({
    where: { id, userId: user.id },
  });

  if (!session) {
    return jsonError("Дыялог не знойдзены.", 404);
  }

  await prisma.chatSession.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
