export interface BadgeStats {
  bestStreak: number;
  totalMeals: number;
  maxMealsInDay: number;
  daysOnTarget: number;
  waterDays: number;
  kgLost: number;
  weighIns: number;
}

export interface Badge {
  id: string;
  title: string;
  detail: string;
  glyph: string;
  test: (s: BadgeStats) => boolean;
}

export const BADGES: Badge[] = [
  { id: 'meals-1', title: 'First Bite', detail: 'Log your first meal', glyph: '1', test: s => s.totalMeals >= 1 },
  { id: 'streak-3', title: 'Warming Up', detail: '3-day streak', glyph: '3', test: s => s.bestStreak >= 3 },
  { id: 'streak-7', title: 'Full Week', detail: '7-day streak', glyph: '7', test: s => s.bestStreak >= 7 },
  { id: 'streak-30', title: 'Habit Formed', detail: '30-day streak', glyph: '30', test: s => s.bestStreak >= 30 },
  { id: 'streak-100', title: 'Centurion', detail: '100-day streak', glyph: 'C', test: s => s.bestStreak >= 100 },
  { id: 'streak-365', title: 'Year Round', detail: '365-day streak', glyph: 'Y', test: s => s.bestStreak >= 365 },
  { id: 'day-3', title: 'Three Squares', detail: '3 meals in one day', glyph: '◔', test: s => s.maxMealsInDay >= 3 },
  { id: 'day-5', title: 'Grazer', detail: '5 entries in one day', glyph: '◑', test: s => s.maxMealsInDay >= 5 },
  { id: 'meals-50', title: 'Regular', detail: '50 meals logged', glyph: 'L', test: s => s.totalMeals >= 50 },
  { id: 'meals-250', title: 'Archivist', detail: '250 meals logged', glyph: 'A', test: s => s.totalMeals >= 250 },
  { id: 'target-7', title: 'On the Mark', detail: '7 days within 10% of target', glyph: '◎', test: s => s.daysOnTarget >= 7 },
  { id: 'target-30', title: 'Dialed In', detail: '30 days within 10% of target', glyph: '◉', test: s => s.daysOnTarget >= 30 },
  { id: 'water-7', title: 'Well Watered', detail: 'Hit water goal 7 days', glyph: '≈', test: s => s.waterDays >= 7 },
  { id: 'weigh-10', title: 'Scale Regular', detail: '10 weigh-ins', glyph: '⚖', test: s => s.weighIns >= 10 },
  { id: 'lost-5', title: 'First Five', detail: 'Lose 5 lb', glyph: '5', test: s => s.kgLost >= 2.268 },
  { id: 'lost-20', title: 'Twenty Down', detail: 'Lose 20 lb', glyph: '20', test: s => s.kgLost >= 9.072 },
];

export const earnedBadges = (s: BadgeStats) => BADGES.filter(b => b.test(s));
