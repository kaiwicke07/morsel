import { describe, it, expect } from 'vitest';
import { burnedFor, garminBonus } from './garmin';
import { computePlan } from './plan';
import type { Profile } from './types';

const today = new Date(2026, 10, 18);
const p: Profile = {
  sex: 'male', birthday: '1996-01-01', heightCm: 180, weightKg: 80, goalWeightKg: 75,
  goal: 'lose', activity: 'mid', paceLbPerWeek: 1, diet: 'classic', units: 'imperial',
  addBurned: true, rollover: false,
};

describe('Garmin calories', () => {
  it('with Garmin, the plan starts from a no-exercise baseline (BMR x 1.2)', () => {
    expect(computePlan(p, today, { garmin: true }).kcal).toBe(1636); // 1780 * 1.2 - 500
    expect(computePlan(p, today).kcal).toBe(2259); // unchanged without Garmin
  });
  it('credits only what Garmin measured above that baseline', () => {
    expect(garminBonus(2600, 2136)).toBe(464);
  });
  it('adds manual exercise on top of the Garmin credit, and ignores Garmin when it is off', () => {
    const day = { date: '2026-11-16', steps: 13857, stepGoal: 8000, restingKcal: 2148, activeKcal: 445, totalKcal: 2593 };
    expect(burnedFor(100, day, 2136, true)).toBe(557);
    expect(burnedFor(100, day, 2136, false)).toBe(100);
    expect(burnedFor(100, undefined, 2136, true)).toBe(100);
  });
  it('never lowers the budget on a quiet day or early in the morning', () => {
    expect(garminBonus(900, 2136)).toBe(0);
    expect(garminBonus(null, 2136)).toBe(0);
  });
});
