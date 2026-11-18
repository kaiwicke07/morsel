/** What the relay returns for one day. */
export interface GarminDay {
  date: string;
  steps: number | null;
  stepGoal: number | null;
  restingKcal: number | null;
  activeKcal: number | null;
  totalKcal: number | null;
}

export interface GarminActivity {
  id: string;
  date: string;
  name: string;
  type: string;
  start: string;
  minutes: number;
  kcal: number;
}

/**
 * With Garmin on, the plan assumes no exercise (BMR x 1.2). Garmin's total burn
 * above that baseline is added to the day. It never goes negative, so the budget
 * doesn't drop on a quiet day or early in the morning before the watch has counted much.
 */
export function garminBonus(totalKcal: number | null, sedentaryTdee: number): number {
  if (totalKcal === null || !Number.isFinite(totalKcal)) return 0;
  return Math.max(0, Math.round(totalKcal - sedentaryTdee));
}

/** Calories added back for a day: hand-logged exercise plus Garmin's measured burn above the baseline. */
export function burnedFor(manualKcal: number, day: GarminDay | undefined, sedentaryTdee: number, garminOn: boolean): number {
  return manualKcal + (garminOn && day ? garminBonus(day.totalKcal, sedentaryTdee) : 0);
}
