import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const AI_CALLS_PER_HOUR = 20;

function hourStart(now: Date): Date {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  return start;
}


// лимит запросов на час. Чтобы кровые 11 юаней за день не улетели до конца тестинга. Иначе приедем. 
export async function reserveAiCall(userId: string, now = new Date()): Promise<boolean> {
  const windowStart = hourStart(now);

  const updated = await prisma.aiUsage.updateMany({
    where: { userId, windowStart, count: { lt: AI_CALLS_PER_HOUR } },
    data: { count: { increment: 1 } },
  });
  if (updated.count === 1) return true;

  try {
    await prisma.aiUsage.create({ data: { userId, windowStart, count: 1 } });
    return true;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    const retry = await prisma.aiUsage.updateMany({
      where: { userId, windowStart, count: { lt: AI_CALLS_PER_HOUR } },
      data: { count: { increment: 1 } },
    });
    return retry.count === 1;
  }
}
//Пока даж не сыпется, прикольно, не хочу сюда возвращаться больше). Да, нормально, закрыт.