import { describe, it, expect } from 'vitest';
import { computePlan, goalDate } from './plan';
import type { Profile } from './types';

const today = new Date(2026, 10, 18);
const base: Profile = {
  sex: 'male', birthday: '1996-01-01', heightCm: 180, weightKg: 80, goalWeightKg: 75.46,
  goal: 'lose', activity: 'mid', paceLbPerWeek: 1, diet: 'classic', units: 'imperial',
  addBurned: false, rollover: false,
};

describe('computePlan', () => {
  it('uses Mifflin-St Jeor x activity minus pace deficit', () => {
    const t = computePlan(base, today);
    expect(t.kcal).toBe(2259); // 1780 * 1.55 - 500
  });
  it('splits macros: protein 0.8 g/lb clamped to >=25%, fat 27%, carbs the rest', () => {
    const t = computePlan(base, today);
    expect(t.protein).toBe(141);
    expect(t.fat).toBe(68);
    expect(t.carbs).toBe(271);
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(12);
  });
  it('never goes below the 1200 kcal floor for women', () => {
    const t = computePlan({ ...base, sex: 'female', birthday: '1966-01-01', heightCm: 150, weightKg: 45, activity: 'low', paceLbPerWeek: 2 }, today);
    expect(t.kcal).toBe(1200);
  });
  it('never goes below 1500 kcal for men', () => {
    const t = computePlan({ ...base, weightKg: 55, heightCm: 160, activity: 'low', paceLbPerWeek: 3 }, today);
    expect(t.kcal).toBe(1500);
  });
  it('adds a surplus when gaining and ignores pace on maintain', () => {
    expect(computePlan({ ...base, goal: 'gain', paceLbPerWeek: 0.5 }, today).kcal).toBe(3009);
    expect(computePlan({ ...base, goal: 'maintain' }, today).kcal).toBe(2759);
  });
  it('sets fiber, sugar, sodium and water targets', () => {
    const t = computePlan(base, today);
    expect(t.fiber).toBe(32); // 14 g per 1000 kcal
    expect(t.sugar).toBe(56); // 10% of kcal / 4
    expect(t.sodium).toBe(2300);
    expect(t.water).toBe(2640); // 33 ml/kg
  });
});

describe('goalDate', () => {
  it('projects the date from pace', () => {
    const d = goalDate({ ...base, goalWeightKg: 80 - 10 / 2.20462 }, today)!;
    expect(Math.round((d.getTime() - today.getTime()) / 86400000)).toBe(70);
  });
  it('returns null when maintaining', () => {
    expect(goalDate({ ...base, goal: 'maintain' }, today)).toBeNull();
  });
});
