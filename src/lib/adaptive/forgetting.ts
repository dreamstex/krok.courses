export function getExpectedReviewDays(correctStreak: number): number {
  if (correctStreak <= 0) return 1;
  if (correctStreak === 1) return 1;
  if (correctStreak === 2) return 3;
  return 7;
}


//чем ближе к 1 тем сильнее забыл тему
export function calculateForgettingScore(
  lastSeenAt: Date | null,
  correctStreak: number,
  now: Date,
): number {
  if (!lastSeenAt) return 1;
  if (correctStreak <= 0) return 1;

  const daysSince = (now.getTime() - lastSeenAt.getTime()) / 86_400_000;
  const interval = getExpectedReviewDays(correctStreak);
  return Math.min(Math.max(daysSince / interval, 0), 1);
}
