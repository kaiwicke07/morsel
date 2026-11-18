import { describe, it, expect } from 'vitest';
import { normalizeDays, normalizeActivities, validRange, codeMatches } from './normalize.js';

describe('relay normalize', () => {
  it('maps daily summaries and step goals by date', () => {
    const days = normalizeDays(
      { data: [{ calendarDate: '2026-11-17', calories: { burnedResting: 1750, burnedActive: 420.6, burnedTotal: 2170.6 }, movement: { steps: { value: 9100, goal: 8000 } } }] },
      [{ calendarDate: '2026-11-17', totalSteps: 9123, stepGoal: 8000 }],
    );
    expect(days).toEqual([{ date: '2026-11-17', steps: 9123, stepGoal: 8000, restingKcal: 1750, activeKcal: 421, totalKcal: 2171 }]);
  });

  it('keeps days that only have steps', () => {
    const days = normalizeDays({ data: [] }, [{ calendarDate: '2026-11-18', totalSteps: 500, stepGoal: 9000 }]);
    expect(days[0]).toMatchObject({ date: '2026-11-18', steps: 500, totalKcal: null });
  });

  it('tolerates missing pieces', () => {
    expect(normalizeDays(undefined, undefined)).toEqual([]);
    expect(normalizeDays({ data: [{ calendarDate: '2026-11-17' }] }, [])).toEqual([{ date: '2026-11-17', steps: null, stepGoal: null, restingKcal: null, activeKcal: null, totalKcal: null }]);
  });

  it('maps activities with local date, minutes and calories', () => {
    const acts = normalizeActivities([
      { activityId: 1, activityName: 'Morning Ride', activityType: { typeKey: 'cycling' }, startTimeLocal: '2026-11-14 07:05:00', duration: 1620.4, calories: 110.2 },
      { activityId: 2, activityType: { typeKey: 'strength_training' }, startTimeLocal: '2026-11-15 18:00:00', duration: 3000, calories: null },
    ]);
    expect(acts).toEqual([
      { id: '1', date: '2026-11-14', name: 'Morning Ride', type: 'cycling', start: '2026-11-14T07:05:00', minutes: 27, kcal: 110 },
      { id: '2', date: '2026-11-15', name: 'Strength training', type: 'strength_training', start: '2026-11-15T18:00:00', minutes: 50, kcal: 0 },
    ]);
  });

  it('validates the date range', () => {
    expect(validRange('2026-11-01', '2026-11-18')).toBe(true);
    expect(validRange('2026-11-18', '2026-11-01')).toBe(false);
    expect(validRange('2026-01-01', '2026-11-18')).toBe(false); // over 31 days
    expect(validRange('nope', '2026-11-18')).toBe(false);
  });

  it('compares the sync code safely', () => {
    expect(codeMatches('abc123', 'abc123')).toBe(true);
    expect(codeMatches('abc124', 'abc123')).toBe(false);
    expect(codeMatches('', 'abc123')).toBe(false);
    expect(codeMatches('abc123', '')).toBe(false);
  });
});
