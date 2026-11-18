import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { analyze, fix, type FoodResult } from './lib/ai';
import { db, type SavedFood, type Settings } from './lib/db';
import { dayHealthScore, dayTargets, loggedDaysFrom, rolloverFrom, sumEntries } from './lib/day';
import { prepareImage } from './lib/image';
import type { LookupFood } from './lib/lookup/off';
import { bmr, computePlan, SEDENTARY_FACTOR } from './lib/plan';
import { burnedFor, type GarminActivity, type GarminDay } from './lib/garmin';
import type { ExerciseEntry, FoodEntry, Nutrients, Targets } from './lib/types';
import { goalFor, orphanPhotoIds } from './lib/maintenance';
import { addDays, todayIso } from './lib/units';

/* ------------------------------------------------------------------ hooks */

export const useSettings = () => useLiveQuery(() => db.settings.get('me'), [], null as Settings | null | undefined);

export const garminOn = (s: Settings) => !!(s.garmin?.enabled && s.garmin.code);
/** Days before Garmin was connected kept a goal that already assumed exercise; don't add Garmin on top of those. */
const garminCounts = (s: Settings, date: string) => garminOn(s) && date >= (s.garmin?.since ?? '9999');

export function baseTargets(s: Settings): Targets {
  return s.customTargets ?? computePlan(s.profile, new Date(), { garmin: garminOn(s) });
}

/** The no-exercise burn Garmin's measured total is compared against. */
export const sedentaryTdee = (s: Settings) => bmr(s.profile) * SEDENTARY_FACTOR;

/** Freeze today's goal so it survives later changes to weight or goals. */
export async function snapshotToday() {
  const s = await db.settings.get('me');
  if (s?.onboarded) await db.dayGoals.put({ date: todayIso(), targets: baseTargets(s) });
}

async function goalOn(date: string, s: Settings): Promise<Targets> {
  const snap = await db.dayGoals.get(date);
  return goalFor(date, todayIso(), snap ? { [date]: snap.targets } : {}, baseTargets(s));
}

export function useGoalSnapshots(): Record<string, Targets> {
  return useLiveQuery(async () => Object.fromEntries((await db.dayGoals.toArray()).map(g => [g.date, g.targets])), [], {} as Record<string, Targets>);
}

export interface DayData {
  entries: FoodEntry[];
  exercises: ExerciseEntry[];
  waterMl: number;
  eaten: Nutrients;
  burned: number;
  rollover: number;
  targets: Targets;
  base: Targets;
  healthScore: number;
  garmin?: GarminDay;
  garminActivities: GarminActivity[];
  manualBurned: number;
}

export function useDay(date: string, s: Settings | null | undefined): DayData | undefined {
  return useLiveQuery(async () => {
    if (!s) return undefined;
    const [entries, exercises, water, gDay, gActs] = await Promise.all([
      db.entries.where('date').equals(date).toArray(),
      db.exercises.where('date').equals(date).toArray(),
      db.water.where('date').equals(date).toArray(),
      db.garminDays.get(date),
      db.garminActivities.where('date').equals(date).toArray(),
    ]);
    entries.sort((a, b) => b.createdAt - a.createdAt);
    exercises.sort((a, b) => b.createdAt - a.createdAt);
    const base = await goalOn(date, s);
    const manualBurned = exercises.reduce((n, e) => n + e.kcal, 0);
    const burned = burnedFor(manualBurned, gDay, sedentaryTdee(s), garminCounts(s, date));
    let rollover = 0;
    if (s.profile.rollover) {
      const y = addDays(date, -1);
      const [yEntries, yEx, yG] = await Promise.all([db.entries.where('date').equals(y).toArray(), db.exercises.where('date').equals(y).toArray(), db.garminDays.get(y)]);
      const yBurn = burnedFor(yEx.reduce((n, e) => n + e.kcal, 0), yG, sedentaryTdee(s), garminCounts(s, y));
      const yTarget = dayTargets(await goalOn(y, s), { burned: yBurn, addBurned: s.profile.addBurned, rollover: 0 }).kcal;
      const ready = yEntries.filter(e => e.status === 'ready');
      rollover = rolloverFrom(sumEntries(ready).kcal, yTarget, ready.length > 0);
    }
    return {
      entries,
      exercises,
      waterMl: water.reduce((n, w) => n + w.ml, 0),
      eaten: sumEntries(entries),
      burned,
      rollover,
      base,
      targets: dayTargets(base, { burned, addBurned: s.profile.addBurned, rollover }),
      healthScore: dayHealthScore(entries),
      garmin: gDay,
      garminActivities: gActs.sort((a, b) => (a.start < b.start ? 1 : -1)),
      manualBurned,
    };
  }, [date, s]);
}

export function useCurrentWeight(s: Settings | null | undefined): number | undefined {
  const last = useLiveQuery(() => db.weights.orderBy('createdAt').last(), []);
  return last?.kg ?? s?.profile.weightKg;
}

/** Object URL for a stored photo; revoked on unmount. */
export function usePhoto(photoId: number | undefined, which: 'thumb' | 'full' = 'thumb'): string | undefined {
  const row = useLiveQuery(() => (photoId ? db.photos.get(photoId) : undefined), [photoId]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!row) return setUrl(undefined);
    const u = URL.createObjectURL(row[which]);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [row, which]);
  return url;
}

export function useLoggedDays(): Set<string> {
  const dates = useLiveQuery(async () => [...loggedDaysFrom(await db.entries.toArray())], []);
  return useMemo(() => new Set(dates ?? []), [dates]);
}

/* ---------------------------------------------------------------- actions */

const inFlight = new Set<number>();

function applyResult(r: FoodResult): Partial<FoodEntry> {
  return { name: r.name, per: r.per, ingredients: r.ingredients, healthScore: r.healthScore, status: 'ready', error: undefined, healthNote: r.healthNote, confidence: r.confidence };
}

const emptyNutrients = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });

export async function runAnalysis(id: number) {
  if (inFlight.has(id)) return;
  const e = await db.entries.get(id);
  if (!e) return;
  inFlight.add(id);
  await db.entries.update(id, { status: 'analyzing', error: undefined });
  try {
    let r: FoodResult;
    if (e.source === 'text') r = await analyze({ kind: 'text', text: e.note || e.name });
    else {
      const photo = e.photoId ? await db.photos.get(e.photoId) : undefined;
      if (!photo) throw new Error('The photo is missing.');
      r = await analyze(e.source === 'label' ? { kind: 'label', image: photo.full } : { kind: 'photo', image: photo.full, hint: e.note });
    }
    await db.entries.update(id, applyResult(r));
  } catch (err) {
    await db.entries.update(id, { status: 'error', error: err instanceof Error ? err.message : String(err) });
  } finally {
    inFlight.delete(id);
  }
}

export async function logPhoto(date: string, file: Blob, kind: 'photo' | 'label', hint?: string): Promise<number> {
  if (date === todayIso()) void snapshotToday();
  const { full, thumb } = await prepareImage(file);
  const photoId = await db.photos.add({ full, thumb, createdAt: Date.now() });
  const id = await db.entries.add({
    date,
    createdAt: Date.now(),
    name: kind === 'label' ? 'Reading label' : 'Analyzing',
    source: kind,
    status: 'analyzing',
    servings: 1,
    per: emptyNutrients(),
    ingredients: [],
    healthScore: 5,
    photoId,
    note: hint,
  });
  void runAnalysis(id);
  return id;
}

export async function logText(date: string, text: string): Promise<number> {
  if (date === todayIso()) void snapshotToday();
  const id = await db.entries.add({
    date,
    createdAt: Date.now(),
    name: text.length > 40 ? text.slice(0, 40) + '…' : text,
    source: 'text',
    status: 'analyzing',
    servings: 1,
    per: emptyNutrients(),
    ingredients: [],
    healthScore: 5,
    note: text,
  });
  void runAnalysis(id);
  return id;
}

export async function applyFix(id: number, note: string) {
  const e = await db.entries.get(id);
  if (!e || inFlight.has(id)) return;
  const prev: FoodResult = { name: e.name, per: e.per, ingredients: e.ingredients, healthScore: e.healthScore, healthNote: '', confidence: 'medium' };
  inFlight.add(id);
  await db.entries.update(id, { status: 'analyzing', error: undefined });
  try {
    const photo = e.photoId ? await db.photos.get(e.photoId) : undefined;
    const r = await fix(prev, note, photo?.full);
    await db.entries.update(id, applyResult(r));
  } catch (err) {
    // keep the previous numbers; surface the error on the entry
    await db.entries.update(id, { status: e.status === 'error' ? 'error' : 'ready', error: err instanceof Error ? err.message : String(err) });
    throw err;
  } finally {
    inFlight.delete(id);
  }
}

export async function logLookup(date: string, f: LookupFood, servings: number, source: 'barcode' | 'search' | 'manual'): Promise<number> {
  if (date === todayIso()) void snapshotToday();
  return db.entries.add({
    date,
    createdAt: Date.now(),
    name: f.brand ? `${f.name}` : f.name,
    source,
    status: 'ready',
    servings,
    per: f.per,
    ingredients: [{ name: f.brand ? `${f.brand} ${f.name}` : f.name, amount: f.amount, ...f.per }],
    healthScore: f.healthScore,
    note: f.brand,
  });
}

export async function logSaved(date: string, s: SavedFood): Promise<number> {
  if (date === todayIso()) void snapshotToday();
  if (s.id) await db.saved.update(s.id, { uses: (s.uses || 0) + 1 });
  return db.entries.add({
    date,
    createdAt: Date.now(),
    name: s.name,
    source: 'saved',
    status: 'ready',
    servings: 1,
    per: s.per,
    ingredients: s.ingredients,
    healthScore: s.healthScore,
    photoId: s.photoId,
  });
}

export async function toggleSaved(e: FoodEntry): Promise<boolean> {
  const existing = await db.saved.where('name').equals(e.name).first();
  if (existing?.id) {
    await db.saved.delete(existing.id);
    return false;
  }
  await db.saved.add({
    name: e.name,
    amount: e.ingredients.length === 1 ? e.ingredients[0].amount : '1 serving',
    per: e.per,
    ingredients: e.ingredients,
    healthScore: e.healthScore,
    photoId: e.photoId,
    createdAt: Date.now(),
    uses: 0,
  });
  return true;
}

export async function deleteEntry(id: number): Promise<FoodEntry | undefined> {
  const e = await db.entries.get(id);
  await db.entries.delete(id);
  // give Undo time to put the entry back before its photo is cleaned up
  if (e?.photoId) setTimeout(() => void purgeOrphanPhotos(), 8000);
  return e;
}

/** Delete stored photos that no entry, saved food or progress photo points at. */
export async function purgeOrphanPhotos() {
  const [ids, entries, saved, progress] = await Promise.all([
    db.photos.toCollection().primaryKeys(),
    db.entries.toArray(),
    db.saved.toArray(),
    db.progressPhotos.toArray(),
  ]);
  const gone = orphanPhotoIds(ids as number[], entries, saved, progress);
  if (gone.length) await db.photos.bulkDelete(gone);
}

export async function restoreEntry(e: FoodEntry) {
  await db.entries.put(e);
}

export async function logWater(date: string, ml: number) {
  if (ml > 0) return db.water.add({ date, createdAt: Date.now(), ml });
  // removing: delete the most recent entries until we've taken off |ml|
  let left = -ml;
  const rows = (await db.water.where('date').equals(date).toArray()).sort((a, b) => b.createdAt - a.createdAt);
  for (const r of rows) {
    if (left <= 0) break;
    if (r.ml <= left) {
      await db.water.delete(r.id!);
      left -= r.ml;
    } else {
      await db.water.update(r.id!, { ml: r.ml - left });
      left = 0;
    }
  }
}

export async function logWeight(kg: number, date: string) {
  await db.weights.add({ date, createdAt: Date.now(), kg });
  const s = await db.settings.get('me');
  if (s) await db.settings.update('me', { profile: { ...s.profile, weightKg: kg } });
}

/** Entries left "analyzing" by a closed app get flipped to a retryable error. */
export async function recoverStale() {
  const stale = await db.entries.filter(e => e.status === 'analyzing' && !inFlight.has(e.id!)).toArray();
  for (const e of stale) await db.entries.update(e.id!, { status: 'error', error: 'Analysis was interrupted. Tap retry.' });
}
