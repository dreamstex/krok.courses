import { NextResponse } from "next/server";
import { getNextTask, getRankedSkills } from "@/lib/learning/next-task";
import { requireUser } from "@/lib/api";
import { getLocale } from "@/lib/i18n-server";

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(request.url);
  const skillId = url.searchParams.get("skillId");
  const now = new Date();
  const locale = await getLocale();

  const [next, rankedSkills] = await Promise.all([
    getNextTask(user.id, now, locale, skillId),
    getRankedSkills(user.id, now, locale),
  ]);
  return NextResponse.json({ next, rankedSkills });
}

