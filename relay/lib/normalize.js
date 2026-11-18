import { timingSafeEqual, createHash } from 'node:crypto';

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round = v => (v === null ? null : Math.round(v));

/** Merge Garmin daily summaries (calories) with daily steps into one row per date. */
export function normalizeDays(summaries, steps) {
  const byDate = new Map();
  const row = date => {
    if (!byDate.has(date)) byDate.set(date, { date, steps: null, stepGoal: null, restingKcal: null, activeKcal: null, totalKcal: null });
    return byDate.get(date);
  };
  for (const s of summaries?.data ?? []) {
    if (!s?.calendarDate) continue;
    const r = row(s.calendarDate);
    r.restingKcal = round(num(s.calories?.burnedResting));
    r.activeKcal = round(num(s.calories?.burnedActive));
    r.totalKcal = round(num(s.calories?.burnedTotal));
    r.steps = round(num(s.movement?.steps?.value));
    r.stepGoal = round(num(s.movement?.steps?.goal));
  }
  for (const s of Array.isArray(steps) ? steps : []) {
    if (!s?.calendarDate) continue;
    const r = row(s.calendarDate);
    if (num(s.totalSteps) !== null) r.steps = round(s.totalSteps);
    if (num(s.stepGoal) !== null) r.stepGoal = round(s.stepGoal);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

const pretty = key => {
  const s = String(key || 'workout').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function normalizeActivities(list) {
  return (Array.isArray(list) ? list : [])
    .filter(a => a?.activityId && a?.startTimeLocal)
    .map(a => {
      const start = String(a.startTimeLocal).replace(' ', 'T');
      return {
        id: String(a.activityId),
        date: start.slice(0, 10),
        name: a.activityName || pretty(a.activityType?.typeKey),
        type: a.activityType?.typeKey || 'other',
        start,
        minutes: Math.round((num(a.duration) ?? 0) / 60),
        kcal: Math.round(num(a.calories) ?? 0),
      };
    });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function validRange(start, end) {
  if (!DATE.test(start || '') || !DATE.test(end || '')) return false;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  return days >= 0 && days <= 31;
}

const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The stored code must already be canonical (uppercase A-Z/0-9, dashes allowed) and 8+ characters; otherwise fail closed. */
const CANONICAL = /^[A-Z0-9-]+$/;

export function codeMatches(given, expected) {
  if (!expected || !CANONICAL.test(expected)) return false;
  expected = expected.replace(/-/g, '');
  if (expected.length < 8) return false;
  given = norm(given); // only the typed code is forgiven for case, spaces and dashes
  if (!given) return false;
  const h = s => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(given), h(expected));
}
