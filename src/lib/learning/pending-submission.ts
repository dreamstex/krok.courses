export interface PendingSubmission {
  submissionId: string;
  taskId: string;
  answer: string;
  usedHint: "0" | "1";
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "krok.pendingSubmission";

export function savePendingSubmission(submission: PendingSubmission, storage: KeyValueStorage = sessionStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(submission));
  } catch {
  }
}

export function loadPendingSubmission(storage: KeyValueStorage = sessionStorage): PendingSubmission | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { submissionId, taskId, answer, usedHint } = parsed as Record<string, unknown>;
    if (typeof submissionId !== "string" || typeof taskId !== "string" || typeof answer !== "string") return null;
    if (usedHint !== "0" && usedHint !== "1") return null;
    return { submissionId, taskId, answer, usedHint };
  } catch {
    return null;
  }
}

export function clearPendingSubmission(storage: KeyValueStorage = sessionStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
  }
}
