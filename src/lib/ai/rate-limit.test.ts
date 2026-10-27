import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db/prisma";
import { reserveAiCall, AI_CALLS_PER_HOUR } from "./rate-limit";

const NOW = new Date("2026-10-12T10:30:00Z");
let userId: string;

before(async () => {
  const user = await prisma.user.create({
    data: { email: `ratelimit-${Date.now()}@test.local`, displayName: "RL", passwordHash: "x" },
  });
  userId = user.id;
});

after(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  await prisma.$disconnect();
});

test("each call reserves one slot, up to the limit", async () => {
  for (let i = 0; i < AI_CALLS_PER_HOUR; i++) {
    assert.equal(await reserveAiCall(userId, NOW), true, `call ${i + 1} should pass`);
  }
});

test("a call over the limit is refused", async () => {
  assert.equal(await reserveAiCall(userId, NOW), false);
});

test("a new hour starts with a fresh budget", async () => {
  const nextHour = new Date("2026-10-12T11:05:00Z");
  assert.equal(await reserveAiCall(userId, nextHour), true);
});

test("a failed AI call still uses the slot", async () => {
  const user = await prisma.user.create({
    data: { email: `ratelimit-fail-${Date.now()}@test.local`, displayName: "RLF", passwordHash: "x" },
  });
  try {
    assert.equal(await reserveAiCall(user.id, NOW), true);
    const row = await prisma.aiUsage.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal(row.count, 1);
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
});

test("parallel requests cannot pass the limit together", async () => {
  const user = await prisma.user.create({
    data: { email: `ratelimit-par-${Date.now()}@test.local`, displayName: "RLP", passwordHash: "x" },
  });
  try {
    const results = await Promise.all(
      Array.from({ length: AI_CALLS_PER_HOUR + 10 }, () => reserveAiCall(user.id, NOW)),
    );
    const passed = results.filter(Boolean).length;
    assert.equal(passed, AI_CALLS_PER_HOUR, `expected exactly ${AI_CALLS_PER_HOUR} passes`);
    const row = await prisma.aiUsage.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal(row.count, AI_CALLS_PER_HOUR);
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
});
