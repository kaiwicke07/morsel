import { it, expect } from 'vitest';
import { earnedBadges, BADGES } from './badges';

const zero = { bestStreak: 0, totalMeals: 0, maxMealsInDay: 0, daysOnTarget: 0, waterDays: 0, kgLost: 0, weighIns: 0 };
it('earns nothing at zero', () => expect(earnedBadges(zero)).toEqual([]));
it('earns streak and meal badges at thresholds', () => {
  const ids = earnedBadges({ ...zero, bestStreak: 7, totalMeals: 50 }).map(b => b.id);
  expect(ids).toContain('streak-3');
  expect(ids).toContain('streak-7');
  expect(ids).not.toContain('streak-30');
  expect(ids).toContain('meals-50');
});
it('every badge has a unique id', () => {
  expect(new Set(BADGES.map(b => b.id)).size).toBe(BADGES.length);
});
