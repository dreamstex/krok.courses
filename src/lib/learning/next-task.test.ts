import { test } from "node:test";
import assert from "node:assert/strict";
import { explainReason } from "./next-task";
import type { SkillProgress } from "./skill-state";

const NOW = new Date("2026-10-12T12:00:00Z");
const DAY = 86_400_000;

function progress(patch: Partial<SkillProgress>): SkillProgress {
  return {
    skillId: "grammar.gender",
    titleBe: "Граматыка: род",
    category: "grammar",
    mastery: 0.5,
    attempts: 3,
    errorCount: 0,
    correctStreak: 0,
    lastSeenAt: NOW,
    ...patch,
  };
}

test("7. an unattempted skill says it is new, not that the user made mistakes", () => {
  const text = explainReason(progress({ attempts: 0, errorCount: 0, lastSeenAt: null }), NOW);
  assert.match(text, /не вывучана/);
});

test("7. a fresh mistake is explained as a recent mistake", () => {
  const text = explainReason(progress({ errorCount: 2, correctStreak: 0 }), NOW);
  assert.match(text, /апошні раз памыліўся/);
});

test("7. an old success is explained as overdue review, not as a mistake", () => {
  const text = explainReason(
    progress({ correctStreak: 4, errorCount: 0, lastSeenAt: new Date(NOW.getTime() - 30 * DAY) }),
    NOW,
  );
  assert.match(text, /даўно не практыкаваўся/);
  assert.doesNotMatch(text, /памыліўся/);
});
