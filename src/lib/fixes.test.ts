import { describe, it, expect } from 'vitest';
import { parseFoodResult } from './ai/schema';
import { stepServings, manualNutritionPatch, loggedDaysFrom } from './day';
import { rollDate } from './units';
import type { FoodEntry } from './types';

const per = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
const entry = (o: Partial<FoodEntry> = {}): FoodEntry => ({
  date: '2026-11-18', createdAt: 1, name: 'x', source: 'photo', status: 'error', error: 'boom', servings: 1, per, ingredients: [], healthScore: 5, ...o,
});

describe('review fixes', () => {
  it('moves the selected day forward at midnight only if the user was on "today"', () => {
    expect(rollDate('2026-11-18', '2026-11-18', '2026-11-19')).toBe('2026-11-19');
    expect(rollDate('2026-11-15', '2026-11-18', '2026-11-19')).toBe('2026-11-15');
    expect(rollDate('2026-11-18', '2026-11-18', '2026-11-18')).toBe('2026-11-18');
  });

  it('hand-entered numbers make a failed entry count', () => {
    const p = manualNutritionPatch(entry(), { ...per, kcal: 600, fat: 2.5 });
    expect(p.status).toBe('ready');
    expect(p.error).toBeUndefined();
    expect(p.per!.kcal).toBe(600);
  });

  it('servings stepper stays on the half-serving grid', () => {
    expect(stepServings(1, -1)).toBe(0.5);
    expect(stepServings(0.5, -1)).toBe(0.25);
    expect(stepServings(0.25, -1)).toBe(0.25);
    expect(stepServings(0.25, 1)).toBe(0.5);
    expect(stepServings(0.5, 1)).toBe(1);
    expect(stepServings(1.25, 1)).toBe(1.5);
  });

  it('missing fiber/sugar/sodium default to 0 instead of failing the scan', () => {
    const r = parseFoodResult({ name: 'Toast', not_food: false, health_score: 5, items: [{ name: 'Toast', amount: '1 slice', kcal: 80, protein: 3, carbs: 14, fat: 1 }] });
    expect(r.per.kcal).toBe(80);
    expect(r.per.sodium).toBe(0);
  });

  it('still fails when calories are missing', () => {
    expect(() => parseFoodResult({ name: 'Toast', not_food: false, items: [{ name: 'Toast', protein: 3 }] })).toThrow();
  });

  it('only counts days with a finished entry toward the streak', () => {
    const days = loggedDaysFrom([entry({ date: 'a', status: 'ready' }), entry({ date: 'b', status: 'error' }), entry({ date: 'c', status: 'analyzing' })]);
    expect([...days]).toEqual(['a']);
  });
});
