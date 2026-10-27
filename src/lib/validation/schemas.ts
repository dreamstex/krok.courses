import { z } from "zod";

export const FREE_TEXT_MIN = 10;
export const FREE_TEXT_MAX = 1000;

export const registerSchema = z.object({
  displayName: z.string().trim().min(1, "name").max(40),
  email: z.string().trim().toLowerCase().email("email").max(120),
  password: z.string().min(8, "password").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("email").max(120),
  password: z.string().min(1, "password").max(100),
});

export const answerSchema = z.object({
  submissionId: z.string().uuid(),
  taskId: z.string().min(1).max(64),
  answer: z.string().trim().max(FREE_TEXT_MAX),
  usedHint: z.enum(["0", "1"]).transform((value) => value === "1"),
});

export const onboardingSchema = z.object({
  knowledgeLevel: z.enum(["none", "some", "good"]),
  interestArea: z.enum(["all", "speaking", "grammar", "vocabulary"]),
  speakingContext: z.string().max(100).optional().nullable(),
  focusTopics: z.array(z.string().max(100)).max(10).optional().default([]),
  minutesPerDay: z.coerce.number().int().min(5).max(120).default(10),
});
