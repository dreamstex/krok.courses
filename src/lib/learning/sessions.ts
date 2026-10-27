import { prisma } from "@/lib/db/prisma";

const SESSION_GAP_MS = 30 * 60_000;

export async function getOrCreateSession(userId: string, now = new Date()) {
  const recent = await prisma.learningSession.findFirst({
    where: { userId, kind: "practice", startedAt: { gte: new Date(now.getTime() - SESSION_GAP_MS) } },
    orderBy: { startedAt: "desc" },
  });
  if (recent) return recent.id;

  const session = await prisma.learningSession.create({ data: { userId, kind: "practice" } });
  return session.id;
}
