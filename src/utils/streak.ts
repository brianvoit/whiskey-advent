export function calculateStreak(
  ratingsMap: Map<number, number | null>,
  whiskeyDays: { id: number; day_number: number }[],
  currentDayOfMonth: number,
): number {
  const ratedDayNumbers = new Set<number>();
  for (const day of whiskeyDays) {
    const rating = ratingsMap.get(day.id);
    if (rating !== undefined && rating !== null) {
      ratedDayNumbers.add(day.day_number);
    }
  }

  // If today isn't rated yet, check from yesterday (streak still alive)
  const startDay = ratedDayNumbers.has(currentDayOfMonth)
    ? currentDayOfMonth
    : currentDayOfMonth - 1;

  if (startDay < 1) return 0;

  let streak = 0;
  for (let d = startDay; d >= 1; d--) {
    if (ratedDayNumbers.has(d)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export const STREAK_MILESTONES = [3, 5, 10, 15, 20, 24] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

export function getStreakMilestone(streak: number): StreakMilestone | null {
  return (STREAK_MILESTONES as readonly number[]).includes(streak)
    ? (streak as StreakMilestone)
    : null;
}
