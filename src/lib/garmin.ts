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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** Check what the relay sent before storing it: bad rows are dropped, a wrong format throws. */
export function parseRelay(body: unknown): { days: GarminDay[]; activities: GarminActivity[] } {
  const b = body as { days?: unknown; activities?: unknown };
  if (!b || typeof b !== 'object' || !Array.isArray(b.days) || !Array.isArray(b.activities)) throw new Error('Unexpected answer from the Garmin relay.');
  const days: GarminDay[] = [];
  for (const d of b.days as Record<string, unknown>[]) {
    if (!d || typeof d.date !== 'string' || !DATE.test(d.date)) continue;
    days.push({ date: d.date, steps: n(d.steps), stepGoal: n(d.stepGoal), restingKcal: n(d.restingKcal), activeKcal: n(d.activeKcal), totalKcal: n(d.totalKcal) });
  }
  const activities: GarminActivity[] = [];
  for (const a of b.activities as Record<string, unknown>[]) {
    if (!a || typeof a.id !== 'string' || typeof a.date !== 'string' || !DATE.test(a.date) || typeof a.start !== 'string') continue;
    activities.push({
      id: a.id.slice(0, 40),
      date: a.date,
      name: String(a.name ?? 'Workout').slice(0, 80),
      type: String(a.type ?? 'other').slice(0, 40),
      start: a.start.slice(0, 25),
      minutes: Math.round(n(a.minutes) ?? 0),
      kcal: Math.round(Math.min(n(a.kcal) ?? 0, 10000)),
    });
  }
  return { days, activities };
}
