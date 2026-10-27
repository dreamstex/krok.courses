import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTaskForSkill } from "./next-task";

function task(id: string, seen = 0) {
  return { id, attempts: Array.from({ length: seen }, (_, i) => ({ id: `${id}-${i}` })) };
}

test("a skill with several tasks does not repeat the task just answered", () => {
  const rows = [task("dative-a"), task("dative-b")];
  const chosen = pickTaskForSkill(rows, "dative-a");
  assert.equal(chosen.id, "dative-b");
});

test("a skill with several tasks alternates: after the other one, the first comes back", () => {
  const rows = [task("dative-a", 1), task("dative-b", 1)];
  assert.equal(pickTaskForSkill(rows, "dative-b").id, "dative-a");
});

test("a skill with a single task returns that task again (intentional future review)", () => {
  const rows = [task("dative-a", 3)];
  assert.equal(pickTaskForSkill(rows, "dative-a").id, "dative-a");
});

test("with no history, the least-seen task is preferred", () => {
  const rows = [task("x", 2), task("y", 0)];
  assert.equal(pickTaskForSkill(rows, null).id, "y");
});

test("choice is deterministic for the same input", () => {
  const rows = [task("a"), task("b"), task("c")];
  const first = pickTaskForSkill(rows, "a").id;
  for (let i = 0; i < 5; i++) assert.equal(pickTaskForSkill(rows, "a").id, first);
});
