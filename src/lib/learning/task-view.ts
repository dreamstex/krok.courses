import type { Task } from "@prisma/client";

export interface TaskView {
  id: string;
  skillId: string;
  type: "choice" | "fill" | "correction" | "free-text";
  prompt: string;
  options: string[];
  answers: string[];
  explanation: string | null;
  explanationRu?: string | null;
}

export interface PublicTask {
  id: string;
  skillId: string;
  type: TaskView["type"];
  prompt: string;
  options: string[];
}


export function toPublicTask(task: TaskView): PublicTask {
  return {
    id: task.id,
    skillId: task.skillId,
    type: task.type,
    prompt: task.prompt,
    options: task.options,
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function toTaskView(task: Task): TaskView {
  return {
    id: task.id,
    skillId: task.skillId,
    type: task.type as TaskView["type"],
    prompt: task.prompt,
    options: asStringArray(task.options),
    answers: asStringArray(task.answers),
    explanation: task.explanation,
    explanationRu: task.explanationRu,
  };
}

//для ленивых как я, кто вместо включения бел раскладки i берет с английской. самая полезная функция всего проекта эвер.
export function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[’ʼ`']/g, "'")
    .replace(/i/g, "і")
    .replace(/^[.!?,"«»„“”\s]+|[.!?,"«»„“”\s]+$/g, "")
    .replace(/\s+/g, " ");
}


// костыль жуткий, но ладно, чтоб засчитывало когда пишут только одно исправленное слово вместо всего предложения. работает - не трогать.
function extractChangedWords(prompt: string, accepted: string): string | null {
  const colonIdx = prompt.indexOf(":");
  const rawSource = colonIdx >= 0 ? prompt.slice(colonIdx + 1) : prompt;
  const origWords = normalizeAnswer(rawSource).split(" ").filter(Boolean);
  const accWords = normalizeAnswer(accepted).split(" ").filter(Boolean);
  if (origWords.length < 2 || accWords.length < 2) return null;

  let prefix = 0;
  while (
    prefix < origWords.length &&
    prefix < accWords.length &&
    origWords[prefix].replace(/[,.;:!?]/g, "") === accWords[prefix].replace(/[,.;:!?]/g, "")
  ) {
    prefix++;
  }

  let origEnd = origWords.length - 1;
  let accEnd = accWords.length - 1;
  while (
    origEnd >= prefix &&
    accEnd >= prefix &&
    origWords[origEnd].replace(/[,.;:!?]/g, "") === accWords[accEnd].replace(/[,.;:!?]/g, "")
  ) {
    origEnd--;
    accEnd--;
  }

  if (accEnd < prefix) return null;
  const changed = accWords.slice(prefix, accEnd + 1).join(" ");
  return changed ? normalizeAnswer(changed) : null;
}

export function gradeClosedTask(
  task: Pick<TaskView, "type" | "prompt" | "answers">,
  answer: string,
): boolean {
  const given = normalizeAnswer(answer);
  if (!given) return false;

  for (const accepted of task.answers) {
    const normAccepted = normalizeAnswer(accepted);
    if (normAccepted === given) return true;

    if (/_{2,}/.test(task.prompt)) {
      const fullReplaced = normalizeAnswer(task.prompt.replace(/_{2,}/, accepted));
      if (fullReplaced === given) return true;
      const colonIdx = task.prompt.indexOf(":");
      if (colonIdx >= 0) {
        const afterColon = task.prompt.slice(colonIdx + 1).replace(/\(.*?\)/g, "");
        const clauseReplaced = normalizeAnswer(afterColon.replace(/_{2,}/, accepted));
        if (clauseReplaced === given) return true;
      }
    }

    const changedWords = extractChangedWords(task.prompt, accepted);
    if (changedWords && changedWords === given) return true;
  }

  return false;
}

export const FREE_TEXT_PASS_SCORE = 0.6;

