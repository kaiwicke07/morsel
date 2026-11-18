import { describe, it, expect } from 'vitest';
import { dayTargets, rolloverFrom, sumEntries, entryTotals } from './day';
import type { FoodEntry, Targets } from './types';

const base: Targets = { kcal: 2000, protein: 150, carbs: 200, fat: 67, fiber: 28, sugar: 50, sodium: 2300, water: 2500 };
const per = { kcal: 400, protein: 30, carbs: 40, fat: 10, fiber: 5, sugar: 8, sodium: 600 };
const entry = (o: Partial<FoodEntry> = {}): FoodEntry => ({
  date: '2026-11-18', createdAt: 1, name: 'x', source: 'manual', status: 'ready', servings: 1,
  per, ingredients: [], healthScore: 7, ...o,
});

describe('dayTargets', () => {
  it('adds burned calories and rollover, scaling macros', () => {
    const t = dayTargets(base, { burned: 300, addBurned: true, rollover: 100 });
    expect(t.kcal).toBe(2400);
    expect(t.protein).toBe(180);
    expect(t.sodium).toBe(2300);
  });
  it('ignores burned when the setting is off', () => {
    expect(dayTargets(base, { burned: 300, addBurned: false, rollover: 100 }).kcal).toBe(2100);
  });
});

describe('rolloverFrom', () => {
  it('caps at 200', () => expect(rolloverFrom(1700, 2000, true)).toBe(200));
  it('rolls the unused amount', () => expect(rolloverFrom(1900, 2000, true)).toBe(100));
  it('is 0 if nothing was logged yesterday', () => expect(rolloverFrom(0, 2000, false)).toBe(0));
  it('is 0 when over target', () => expect(rolloverFrom(2100, 2000, true)).toBe(0));
});

describe('entries', () => {
  it('multiplies per-serving nutrients by servings', () => {
    expect(entryTotals(entry({ servings: 0.5 })).kcal).toBe(200);
    expect(entryTotals(entry({ servings: 2.5 })).protein).toBe(75);
  });
  it('sums only ready entries', () => {
    const s = sumEntries([entry(), entry({ servings: 2 }), entry({ status: 'analyzing' }), entry({ status: 'error' })]);
    expect(s.kcal).toBe(1200);
    expect(s.sodium).toBe(1800);
  });
});
