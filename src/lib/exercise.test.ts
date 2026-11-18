import { it, expect } from 'vitest';
import { exerciseKcal } from './exercise';

it('computes MET x kg x hours for a medium 30-minute run', () => {
  expect(exerciseKcal('run', 2, 30, 70)).toBe(343);
});
it('uses lifting METs', () => {
  expect(exerciseKcal('lift', 3, 60, 80)).toBe(480);
  expect(exerciseKcal('lift', 1, 60, 80)).toBe(280);
});
it('returns 0 for zero or negative minutes', () => {
  expect(exerciseKcal('run', 2, 0, 70)).toBe(0);
  expect(exerciseKcal('run', 2, -5, 70)).toBe(0);
});
