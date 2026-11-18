import type { Targets } from './types';

/** Past days keep the goal they were logged against; today always follows the current plan. */
export function goalFor(date: string, today: string, snapshots: Record<string, Targets>, current: Targets): Targets {
  if (date >= today) return current;
  return snapshots[date] ?? current;
}

const WEEK = 7 * 86400000;

/** Nudge a backup once a week, but not during the first week of use. */
export function backupDue(lastBackupAt: number | undefined, createdAt: number, now: number): boolean {
  if (now - createdAt < WEEK) return false;
  return lastBackupAt === undefined || now - lastBackupAt >= WEEK;
}

type Ref = { photoId?: number };

export function orphanPhotoIds(photoIds: number[], ...refs: Ref[][]): number[] {
  const used = new Set<number>();
  for (const list of refs) for (const r of list) if (r.photoId !== undefined) used.add(r.photoId);
  return photoIds.filter(id => !used.has(id));
}

type BackupData = Record<string, any[]>;

/** A backup without photos must not point at whatever photos happen to be on this phone. */
export function detachPhotos(data: BackupData): BackupData {
  const strip = (rows: any[] | undefined) => (rows ?? []).map(({ photoId: _p, ...r }) => r);
  return { ...data, entries: strip(data.entries), saved: strip(data.saved), progressPhotos: [] };
}

export function validateBackup(data: any): void {
  const bad = (why: string) => {
    throw new Error(`That backup file looks damaged (${why}).`);
  };
  if (!data || typeof data !== 'object') bad('no data');
  if (!Array.isArray(data.settings) || data.settings.length !== 1 || data.settings[0]?.id !== 'me') bad('settings');
  for (const t of ['entries', 'exercises', 'water', 'weights', 'saved', 'progressPhotos']) {
    if (data[t] !== undefined && !Array.isArray(data[t])) bad(t);
  }
  for (const t of ['entries', 'exercises', 'water', 'weights']) {
    for (const r of data[t] ?? []) if (typeof r?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) bad(`${t} date`);
  }
}
