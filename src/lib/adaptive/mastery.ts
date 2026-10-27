export const MASTERY_GAIN_CORRECT = 0.08;
export const MASTERY_GAIN_HINTED = 0.03;
export const MASTERY_LOSS_WRONG = 0.1;

export function clampMastery(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export interface MasteryOutcome {
  isCorrect: boolean;
  usedHint: boolean;
}


export function getMasteryDelta({ isCorrect, usedHint }: MasteryOutcome): number {
  if (!isCorrect) return -MASTERY_LOSS_WRONG;
  return usedHint ? MASTERY_GAIN_HINTED : MASTERY_GAIN_CORRECT;
}

export function updateSkillMastery(mastery: number, outcome: MasteryOutcome): number {
  return clampMastery(mastery + getMasteryDelta(outcome));
}
