import type { FoodEntry, Nutrients, Targets } from './types';

export const NUTRIENT_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const;

export const zeroNutrients = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });

export function scaleNutrients(n: Nutrients, k: number): Nutrients {
  const out = zeroNutrients();
  for (const key of NUTRIENT_KEYS) out[key] = (n[key] || 0) * k;
  return out;
}

/** 0.25 is the floor; above it the stepper moves on a half-serving grid. */
export function stepServings(v: number, dir: 1 | -1): number {
  if (dir < 0) return v <= 0.5 ? 0.25 : Math.ceil(v * 2 - 1) / 2;
  return v < 0.5 ? 0.5 : Math.floor(v * 2 + 1) / 2;
}

/** Hand-entered numbers always make the entry count, even if the scan had failed. */
export function manualNutritionPatch(e: FoodEntry, vals: Nutrients): Partial<FoodEntry> {
  const k = e.per.kcal ? vals.kcal / e.per.kcal : 1;
  const ingredients = e.ingredients.length <= 1
    ? [{ name: e.ingredients[0]?.name ?? e.name, amount: e.ingredients[0]?.amount ?? '1 serving', ...vals }]
    : e.ingredients.map(i => ({ ...i, ...scaleNutrients(i, k) }));
  return { per: vals, ingredients, status: 'ready', error: undefined };
}

export function loggedDaysFrom(entries: FoodEntry[]): Set<string> {
  return new Set(entries.filter(e => e.status === 'ready').map(e => e.date));
}

export const entryTotals = (e: FoodEntry): Nutrients => scaleNutrients(e.per, e.servings);

export function sumEntries(entries: FoodEntry[]): Nutrients {
  const out = zeroNutrients();
  for (const e of entries) {
    if (e.status !== 'ready') continue;
    const t = entryTotals(e);
    for (const key of NUTRIENT_KEYS) out[key] += t[key];
  }
  return out;
}

/** The day's target after adding back exercise (if enabled) and rolled-over calories. Macros scale with kcal. */
export function dayTargets(base: Targets, opts: { burned: number; addBurned: boolean; rollover: number }): Targets {
  const extra = (opts.addBurned ? opts.burned : 0) + opts.rollover;
  if (extra <= 0) return { ...base };
  const k = (base.kcal + extra) / base.kcal;
  return {
    ...base,
    kcal: Math.round(base.kcal + extra),
    protein: Math.round(base.protein * k),
    carbs: Math.round(base.carbs * k),
    fat: Math.round(base.fat * k),
  };
}

export const ROLLOVER_CAP = 200;

export function rolloverFrom(yesterdayKcal: number, yesterdayTarget: number, hadFood: boolean): number {
  if (!hadFood) return 0;
  return Math.round(Math.min(ROLLOVER_CAP, Math.max(0, yesterdayTarget - yesterdayKcal)));
}

/** Average of entry health scores weighted by calories; 0 when nothing logged. */
export function dayHealthScore(entries: FoodEntry[]): number {
  let w = 0, s = 0;
  for (const e of entries) {
    if (e.status !== 'ready') continue;
    const kcal = Math.max(1, entryTotals(e).kcal);
    w += kcal;
    s += kcal * e.healthScore;
  }
  return w ? Math.round((s / w) * 10) / 10 : 0;
}
