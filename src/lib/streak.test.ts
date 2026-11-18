import { it, expect } from 'vitest';
import { currentStreak, bestStreak } from './streak';

it('counts consecutive days ending today', () => {
  expect(currentStreak(new Set(['2026-11-16', '2026-11-17', '2026-11-18']), '2026-11-18')).toBe(3);
});
it('still counts when today is not logged yet but yesterday was', () => {
  expect(currentStreak(new Set(['2026-11-16', '2026-11-17']), '2026-11-18')).toBe(2);
});
it('is broken by a gap', () => {
  expect(currentStreak(new Set(['2026-11-14', '2026-11-15', '2026-11-18']), '2026-11-18')).toBe(1);
  expect(currentStreak(new Set(['2026-11-15']), '2026-11-18')).toBe(0);
});
it('crosses month boundaries', () => {
  expect(currentStreak(new Set(['2026-10-31', '2026-11-01']), '2026-11-01')).toBe(2);
});
it('finds the best run ever', () => {
  expect(bestStreak(new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-10']))).toBe(3);
});
