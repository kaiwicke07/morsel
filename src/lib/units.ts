export const LB_PER_KG = 2.20462;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  let total = Math.round(cm / 2.54);
  const ft = Math.floor(total / 12);
  total -= ft * 12;
  return { ft, inch: total };
}
export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * 2.54;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export const todayIso = () => isoDate(new Date());

/** After midnight, follow the calendar if the user was looking at "today"; leave other days alone. */
export const rollDate = (selected: string, lastToday: string, nowToday: string) => (selected === lastToday ? nowToday : selected);

export function ageOn(birthday: string, on: Date): number {
  const b = parseIso(birthday);
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
  return age;
}

export function fmtWeight(kg: number, units: 'imperial' | 'metric', digits = 1): string {
  return units === 'imperial' ? `${kgToLb(kg).toFixed(digits)} lb` : `${kg.toFixed(digits)} kg`;
}
