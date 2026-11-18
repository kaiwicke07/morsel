export const METS = {
  run: { 1: 3.5, 2: 9.8, 3: 14.5 },
  lift: { 1: 3.5, 2: 5, 3: 6 },
} as const;

export const INTENSITY_COPY = {
  run: {
    3: { title: 'Hard', hint: 'Sprints, intervals, racing' },
    2: { title: 'Steady', hint: 'Jogging around 6 mph' },
    1: { title: 'Easy', hint: 'Brisk walk, around 3 mph' },
  },
  lift: {
    3: { title: 'Hard', hint: 'Heavy sets, close to failure' },
    2: { title: 'Steady', hint: 'Working sets, short rests' },
    1: { title: 'Easy', hint: 'Light weights, lots of rest' },
  },
} as const;

export function exerciseKcal(kind: 'run' | 'lift', intensity: 1 | 2 | 3, minutes: number, kg: number): number {
  if (!(minutes > 0)) return 0;
  return Math.round(METS[kind][intensity] * kg * (minutes / 60));
}
