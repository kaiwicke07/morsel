import type { Activity, Profile, Targets } from './types';
import { ageOn, kgToLb, LB_PER_KG } from './units';

export const ACTIVITY_FACTOR: Record<Activity, number> = { low: 1.375, mid: 1.55, high: 1.725 };

export function bmr(p: Profile, today = new Date()): number {
  const age = ageOn(p.birthday, today);
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age;
  // 'other' uses the midpoint of the male (+5) and female (-161) constants
  const sexAdj = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  return base + sexAdj;
}

export const tdee = (p: Profile, today = new Date()) => bmr(p, today) * ACTIVITY_FACTOR[p.activity];

export const SEDENTARY_FACTOR = 1.2;

/** With Garmin, start from a no-exercise baseline; Garmin's measured burn is added per day instead. */
export function computePlan(p: Profile, today = new Date(), opts: { garmin?: boolean } = {}): Targets {
  let kcal = opts.garmin ? bmr(p, today) * SEDENTARY_FACTOR : tdee(p, today);
  if (p.goal === 'lose') kcal -= p.paceLbPerWeek * 500;
  if (p.goal === 'gain') kcal += p.paceLbPerWeek * 500;
  const floor = p.sex === 'female' ? 1200 : p.sex === 'male' ? 1500 : 1350;
  kcal = Math.round(Math.max(floor, kcal));

  const fatKcal = kcal * 0.27;
  const proteinKcal = Math.min(0.35 * kcal, Math.max(0.25 * kcal, kgToLb(p.weightKg) * 0.8 * 4));
  const carbsKcal = kcal - fatKcal - proteinKcal;

  return {
    kcal,
    protein: Math.round(proteinKcal / 4),
    carbs: Math.round(carbsKcal / 4),
    fat: Math.round(fatKcal / 9),
    fiber: Math.round((kcal / 1000) * 14),
    sugar: Math.round((kcal * 0.1) / 4),
    sodium: 2300,
    water: Math.round((p.weightKg * 33) / 10) * 10,
  };
}

/** When the goal weight is reached at the chosen pace, or null if maintaining / already there. */
export function goalDate(p: Profile, from = new Date()): Date | null {
  if (p.goal === 'maintain' || p.paceLbPerWeek <= 0) return null;
  const diffLb = Math.abs(p.weightKg - p.goalWeightKg) * LB_PER_KG;
  if (diffLb < 0.1) return null;
  const days = Math.round((diffLb / p.paceLbPerWeek) * 7);
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiBand(v: number): 'Underweight' | 'Healthy' | 'Overweight' | 'Obese' {
  if (v < 18.5) return 'Underweight';
  if (v < 25) return 'Healthy';
  if (v < 30) return 'Overweight';
  return 'Obese';
}
