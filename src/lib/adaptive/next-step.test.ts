import { test } from "node:test";
import assert from "node:assert/strict";
import { clampMastery, updateSkillMastery } from "./mastery";
import { rankSkills, pickFromTop, type SkillCandidate } from "./next-step";
import { calculateForgettingScore } from "./forgetting";

const NOW = new Date("2026-10-12T12:00:00Z");
const DAY = 86_400_000;
const goal = { focus: "balanced" as const };

function skill(id: string, patch: Partial<SkillCandidate> = {}): SkillCandidate {
  return {
    skillId: id,
    category: "grammar",
    mastery: 0.5,
    attempts: 3,
    correctStreak: 0,
    lastSeenAt: NOW,
    ...patch,
  };
}

test("mastery stays within 0..1", () => {
  assert.equal(clampMastery(1.4), 1);
  assert.equal(clampMastery(-0.3), 0);
  let m = 0.95;
  for (let i = 0; i < 10; i++) m = updateSkillMastery(m, { isCorrect: true, usedHint: false });
  assert.equal(m, 1);
  m = 0.05;
  for (let i = 0; i < 10; i++) m = updateSkillMastery(m, { isCorrect: false, usedHint: false });
  assert.equal(m, 0);
});

test("a correct answer increases mastery; a hinted one increases it less", () => {
  const plain = updateSkillMastery(0.5, { isCorrect: true, usedHint: false });
  const hinted = updateSkillMastery(0.5, { isCorrect: true, usedHint: true });
  assert.ok(plain > 0.5);
  assert.ok(hinted > 0.5 && hinted < plain);
});

test("a wrong answer decreases mastery", () => {
  assert.ok(updateSkillMastery(0.5, { isCorrect: false, usedHint: false }) < 0.5);
});


test("1. a completely new learner: unassessed skills are not scored as weak", () => {
  const fresh = rankSkills(
    [
      skill("grammar.gender", { attempts: 0, mastery: 0.2, lastSeenAt: null }),
      skill("grammar.number", { attempts: 0, mastery: 0.2, lastSeenAt: null }),
    ],
    goal,
    NOW,
  );
  assert.equal(fresh[0].score, fresh[1].score);
});

test("1b. an unassessed skill scores below a skill with a fresh mistake", () => {
  const ranked = rankSkills(
    [
      skill("grammar.gender", { attempts: 0, mastery: 0.2, correctStreak: 0, lastSeenAt: null }),
      skill("grammar.number", { attempts: 2, mastery: 0.1, correctStreak: 0, lastSeenAt: NOW }),
    ],
    goal,
    NOW,
  );
  assert.equal(ranked[0].skillId, "grammar.number");
});

test("2. a learner who has just made an error: that skill moves to the top", () => {
  const ranked = rankSkills(
    [
      skill("grammar.gender", { mastery: 0.5, correctStreak: 0, lastSeenAt: NOW }),
      skill("grammar.number", { mastery: 0.5, correctStreak: 3, lastSeenAt: NOW }),
    ],
    goal,
    NOW,
  );
  assert.equal(ranked[0].skillId, "grammar.gender");
});

test("3. a learner who answered correctly several times: that skill drops in priority", () => {
  const ranked = rankSkills(
    [
      skill("grammar.gender", { mastery: 0.8, correctStreak: 4, lastSeenAt: NOW }),
      skill("grammar.number", { mastery: 0.4, correctStreak: 0, lastSeenAt: NOW }),
    ],
    goal,
    NOW,
  );
  assert.equal(ranked[0].skillId, "grammar.number");
});

test("4. a previously successful skill not reviewed for a while regains priority", () => {
  const longAgo = new Date(NOW.getTime() - 30 * DAY);
  const ranked = rankSkills(
    [
      skill("grammar.gender", { mastery: 0.8, correctStreak: 4, lastSeenAt: longAgo }),
      skill("grammar.number", { mastery: 0.8, correctStreak: 4, lastSeenAt: NOW }),
    ],
    goal,
    NOW,
  );
  assert.equal(ranked[0].skillId, "grammar.gender");
  assert.equal(calculateForgettingScore(longAgo, 4, NOW), 1);
});

test("forgetting grows with time since last practice and is capped at 1", () => {
  const fresh = calculateForgettingScore(NOW, 1, NOW);
  const later = calculateForgettingScore(new Date(NOW.getTime() - 1 * DAY), 1, NOW);
  const ancient = calculateForgettingScore(new Date(NOW.getTime() - 400 * DAY), 1, NOW);
  assert.equal(fresh, 0);
  assert.ok(later > fresh);
  assert.equal(ancient, 1);
});

test("5. a diagnostic covering only some skills: uncovered skills stay unassessed, not weak", () => {
  const ranked = rankSkills(
    [
      skill("grammar.gender", { mastery: 0.3, attempts: 1, correctStreak: 0, lastSeenAt: NOW }),
      skill("grammar.number", { mastery: 0.9, attempts: 1, correctStreak: 3, lastSeenAt: NOW }),
      skill("grammar.dative", { attempts: 0, mastery: 0.2, lastSeenAt: null }),
    ],
    goal,
    NOW,
  );
  assert.equal(ranked[0].skillId, "grammar.gender");
  assert.equal(ranked[ranked.length - 1].skillId, "grammar.number");
});

test("6. two users with different profiles get different recommendations", () => {
  const profileA = [
    skill("grammar.past-tense", { mastery: 0.1, correctStreak: 0 }),
    skill("vocabulary.food", { category: "vocabulary", mastery: 0.9, correctStreak: 3 }),
  ];
  const profileB = [
    skill("grammar.past-tense", { mastery: 0.9, correctStreak: 3 }),
    skill("vocabulary.food", { category: "vocabulary", mastery: 0.1, correctStreak: 0 }),
  ];
  const a = pickFromTop(rankSkills(profileA, goal, NOW), 0, 1);
  const b = pickFromTop(rankSkills(profileB, goal, NOW), 0, 1);
  assert.equal(a?.skillId, "grammar.past-tense");
  assert.equal(b?.skillId, "vocabulary.food");
});

test("pickFromTop is deterministic for the same index", () => {
  const ranked = [{ skillId: "a" }, { skillId: "b" }, { skillId: "c" }];
  assert.equal(pickFromTop(ranked, 4, 3)?.skillId, pickFromTop(ranked, 4, 3)?.skillId);
  assert.equal(pickFromTop([], 0), undefined);
});
