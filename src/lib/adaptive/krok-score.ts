// веса для формулы krok score (в сумме дают 1.0)
export const KROK_WEIGHTS = {
  weakness: 0.5,
  forgetting: 0.3,
  goalMatch: 0.2,
} as const;

export interface KrokScoreInput {
  mastery: number;
  forgetting: number;
  goalMatch: number;
}


export function calculateKrokScore(input: KrokScoreInput): number {
  const weakness = 1 - input.mastery;
  const score =
    weakness * KROK_WEIGHTS.weakness +
    input.forgetting * KROK_WEIGHTS.forgetting +
    input.goalMatch * KROK_WEIGHTS.goalMatch;

  return Math.min(Math.max(score, 0), 1);
}
