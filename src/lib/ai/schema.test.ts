import { describe, it, expect } from 'vitest';
import { parseFoodResult, parseExerciseResult } from './schema';

const good = {
  name: 'Chicken burrito bowl',
  not_food: false,
  confidence: 'medium',
  health_score: 7,
  health_note: 'Good protein, watch the sodium.',
  items: [
    { name: 'Rice', amount: '1 cup', kcal: 205, protein: 4.3, carbs: 45, fat: 0.4, fiber: 0.6, sugar: 0, sodium: 2 },
    { name: 'Chicken', amount: '4 oz', kcal: 187, protein: 35, carbs: 0, fat: 4, fiber: 0, sugar: 0, sodium: 84 },
  ],
};

describe('parseFoodResult', () => {
  it('sums items into per-serving nutrients', () => {
    const r = parseFoodResult(good);
    expect(r.name).toBe('Chicken burrito bowl');
    expect(r.per.kcal).toBe(392);
    expect(r.per.protein).toBeCloseTo(39.3, 1);
    expect(r.ingredients).toHaveLength(2);
    expect(r.healthScore).toBe(7);
  });
  it('accepts a JSON string, including one wrapped in a code fence', () => {
    expect(parseFoodResult(JSON.stringify(good)).per.kcal).toBe(392);
    expect(parseFoodResult('```json\n' + JSON.stringify(good) + '\n```').per.kcal).toBe(392);
  });
  it('clamps the health score to 1-10 and coerces numeric strings', () => {
    const r = parseFoodResult({ ...good, health_score: 14, items: [{ ...good.items[0], kcal: '205' }] });
    expect(r.healthScore).toBe(10);
    expect(r.per.kcal).toBe(205);
  });
  it('throws a friendly error when the photo is not food', () => {
    expect(() => parseFoodResult({ ...good, not_food: true, items: [] })).toThrow(/food/i);
  });
  it('throws on malformed shapes', () => {
    expect(() => parseFoodResult('not json')).toThrow();
    expect(() => parseFoodResult({ name: 'x' })).toThrow();
    expect(() => parseFoodResult({ ...good, items: [{ name: 'x' }] })).toThrow();
    expect(() => parseFoodResult({ ...good, items: [] })).toThrow();
  });
  it('rejects negative numbers', () => {
    expect(() => parseFoodResult({ ...good, items: [{ ...good.items[0], kcal: -5 }] })).toThrow();
  });
});

describe('parseExerciseResult', () => {
  it('reads label, minutes, kcal', () => {
    expect(parseExerciseResult({ label: 'Yoga', minutes: 45, kcal: 180 })).toEqual({ label: 'Yoga', minutes: 45, kcal: 180 });
  });
  it('throws without kcal', () => {
    expect(() => parseExerciseResult({ label: 'Yoga' })).toThrow();
  });
});
