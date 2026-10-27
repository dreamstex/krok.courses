import { PrismaClient } from "@prisma/client";
import { SKILLS } from "../src/data/skills";
import { SEED_TASKS } from "../src/data/seed-tasks";
const prisma = new PrismaClient();

async function main() {
  for (const skill of SKILLS) {
    const skillData = {
      category: skill.category,
      titleBe: skill.titleBe,
      titleRu: skill.titleRu,
      descriptionBe: skill.descriptionBe,
      descriptionRu: skill.descriptionRu,
    };
    await prisma.skill.upsert({
      where: { id: skill.id },
      update: skillData,
      create: { id: skill.id, ...skillData },
    });
  }


  for (const task of SEED_TASKS) {
    const data = {
      skillId: task.skillId,
      type: task.type,
      level: "base",
      prompt: task.prompt,
      options: task.options ?? undefined,
      answers: task.answers ?? undefined,
      explanation: task.explanation ?? null,
      explanationRu: task.explanationRu ?? null,
      isDiagnostic: Boolean(task.isDiagnostic),
      source: "seed",
      active: true,
    };
    await prisma.task.upsert({
      where: { id: task.id },
      update: data,
      create: { id: task.id, ...data },
    });
  }


  console.log(`Seeded ${SKILLS.length} skills, ${SEED_TASKS.length} tasks.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
