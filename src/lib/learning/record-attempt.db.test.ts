import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { recordAttempt } from "./record-attempt";
import type { TaskView } from "./task-view";

const userId = `test-${randomUUID()}`;
const task: TaskView = {
  id: "past-choice-01",
  skillId: "grammar.past-tense",
  type: "choice",
  prompt: "test",
  options: ["іду", "хадзіў"],
  answers: ["хадзіў"],
  explanation: null,
};

before(async () => {
  await prisma.user.create({
    data: { id: userId, email: `${userId}@test.invalid`, passwordHash: "x", displayName: "test" },
  });
});

after(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test("a second attempt with the same submissionId is rejected and mastery is updated once", async () => {
  const submissionId = randomUUID();
  const input = {
    userId,
    submissionId,
    task,
    answer: "хадзіў",
    usedHint: false,
    sessionId: null,
    testPhase: null,
    outcome: { isCorrect: true, score: null, evaluated: true },
  };

  const attemptsBefore = await prisma.taskAttempt.count({ where: { userId } });

  await recordAttempt(input);
  const afterFirst = await prisma.userSkillState.findUniqueOrThrow({
    where: { userId_skillId: { userId, skillId: task.skillId } },
  });

  await assert.rejects(recordAttempt(input), (error: unknown) => (error as { code?: string }).code === "P2002");

  const skill = await prisma.userSkillState.findUniqueOrThrow({
    where: { userId_skillId: { userId, skillId: task.skillId } },
  });
  assert.equal(await prisma.taskAttempt.count({ where: { userId } }), attemptsBefore + 1);
  assert.equal(skill.attempts, afterFirst.attempts);
  assert.equal(skill.mastery, afterFirst.mastery);
});

test("a new submissionId for the same task is a normal new attempt", async () => {
  const before = await prisma.taskAttempt.count({ where: { userId } });
  const base = {
    userId,
    task,
    answer: "хадзіў",
    usedHint: false,
    sessionId: null,
    testPhase: null,
    outcome: { isCorrect: true, score: null, evaluated: true },
  };
  await recordAttempt({ ...base, submissionId: randomUUID() });
  await recordAttempt({ ...base, submissionId: randomUUID() });
  assert.equal(await prisma.taskAttempt.count({ where: { userId } }), before + 2);
});
