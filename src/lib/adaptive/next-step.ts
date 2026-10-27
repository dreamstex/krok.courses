import { calculateForgettingScore } from "./forgetting";
import { calculateKrokScore } from "./krok-score";

export type SkillCategory = "vocabulary" | "grammar" | "competencies";

export interface SkillCandidate {
  skillId: string;
  category: SkillCategory;
  mastery: number;
  attempts: number;
  correctStreak: number;
  lastSeenAt: Date | null;
}

export const UNKNOWN_SKILL_WEAKNESS = 0.5;

export interface UserGoal {
  focus: "vocabulary" | "grammar" | "free" | "balanced";
}


export function calculateGoalMatch(category: SkillCategory, goal: UserGoal): number {
  if (goal.focus === "balanced" || goal.focus === "free") return 0.5;
  if (goal.focus === "vocabulary") return category === "vocabulary" ? 1 : 0.3;
  return category === "grammar" ? 1 : 0.3;
}

export interface ScoredSkill {
  skillId: string;
  score: number;
}

//сорт навыков по приоритету чтоб дать самый нужный сейчас
export function rankSkills(
  candidates: SkillCandidate[],
  goal: UserGoal,
  now: Date,
): ScoredSkill[] {
  return candidates
    .map((c) => ({
      skillId: c.skillId,
      score: calculateKrokScore({
        mastery: c.attempts === 0 ? 1 - UNKNOWN_SKILL_WEAKNESS : c.mastery,
        forgetting: calculateForgettingScore(c.lastSeenAt, c.correctStreak, now),
        goalMatch: calculateGoalMatch(c.category, goal),
      }),
    }))
    .sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId));
}


export function pickFromTop<T>(ranked: T[], pickIndex: number, topN = 3): T | undefined {
  if (ranked.length === 0) return undefined;
  const window = ranked.slice(0, Math.min(topN, ranked.length));
  return window[Math.abs(pickIndex) % window.length];
}
