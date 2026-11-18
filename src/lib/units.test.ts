import { it, expect } from 'vitest';
import { kgToLb, lbToKg, cmToFtIn, ftInToCm, isoDate, addDays, ageOn } from './units';

it('converts weight', () => {
  expect(kgToLb(80)).toBeCloseTo(176.37, 1);
  expect(lbToKg(176.37)).toBeCloseTo(80, 1);
});
it('converts height', () => {
  expect(cmToFtIn(180)).toEqual({ ft: 5, inch: 11 });
  expect(ftInToCm(5, 11)).toBeCloseTo(180.3, 0);
});
it('formats local dates and adds days across months', () => {
  expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});
it('computes age', () => {
  expect(ageOn('1996-11-19', new Date(2026, 10, 18))).toBe(29);
  expect(ageOn('1996-11-18', new Date(2026, 10, 18))).toBe(30);
});
