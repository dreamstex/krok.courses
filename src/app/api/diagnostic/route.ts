import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireUser } from "@/lib/api";
import { getDiagnosticTasks, getPublicDiagnosticTasks, saveDiagnosticResult } from "@/lib/learning/diagnostic";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

const diagnosticSchema = z.object({
  answers: z.record(z.string().max(64), z.string().max(200)),
});

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const tasks = getPublicDiagnosticTasks(await getDiagnosticTasks(user.id));
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const locale = await getLocale();
  const { user, response } = await requireUser();
  if (!user) return response;

  const parsed = diagnosticSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(t(locale, "diagnostic.badAnswers"), 400);

  const summary = await saveDiagnosticResult(user.id, parsed.data.answers);
  return NextResponse.json({ ok: true, summary });
}
