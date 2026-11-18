import { addDays } from './units';

export function currentStreak(logged: Set<string>, today: string): number {
  let day = logged.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (logged.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(logged: Set<string>): number {
  let best = 0;
  for (const d of logged) {
    if (logged.has(addDays(d, -1))) continue; // not the start of a run
    let n = 0, day = d;
    while (logged.has(day)) { n++; day = addDays(day, 1); }
    best = Math.max(best, n);
  }
  return best;
}
