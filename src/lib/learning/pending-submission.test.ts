import { test } from "node:test";
import assert from "node:assert/strict";
import { clearPendingSubmission, loadPendingSubmission, savePendingSubmission } from "./pending-submission";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const SUBMISSION = {
  submissionId: "3f0c2a7e-7d1b-4c55-9a7e-1e2f3a4b5c6d",
  taskId: "past-choice-01",
  answer: "хадзіў",
  usedHint: "0" as const,
};

test("a submit interrupted by a reload is retried with the same submissionId", () => {
  const storage = fakeStorage();
  savePendingSubmission(SUBMISSION, storage);

  const afterReload = loadPendingSubmission(storage);
  assert.deepEqual(afterReload, SUBMISSION);
});

test("a finished submit clears the pending entry, so the next attempt gets a new id", () => {
  const storage = fakeStorage();
  savePendingSubmission(SUBMISSION, storage);
  clearPendingSubmission(storage);
  assert.equal(loadPendingSubmission(storage), null);
});

test("a corrupt or incomplete entry is ignored instead of crashing the card", () => {
  const storage = fakeStorage();
  storage.setItem("krok.pendingSubmission", "{not json");
  assert.equal(loadPendingSubmission(storage), null);

  storage.setItem("krok.pendingSubmission", JSON.stringify({ submissionId: 42, taskId: "x", answer: "a", usedHint: "0" }));
  assert.equal(loadPendingSubmission(storage), null);
});

test("blocked storage does not throw, the page just loses the reload retry", () => {
  const blocked = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("SecurityError");
    },
  };
  assert.doesNotThrow(() => savePendingSubmission(SUBMISSION, blocked));
  assert.equal(loadPendingSubmission(blocked), null);
  assert.doesNotThrow(() => clearPendingSubmission(blocked));
});
