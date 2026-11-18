import { describe, it, expect } from 'vitest';
import { goalFor, backupDue, orphanPhotoIds, detachPhotos, validateBackup } from './maintenance';
import type { Targets } from './types';

const T = (kcal: number): Targets => ({ kcal, protein: 100, carbs: 200, fat: 60, fiber: 30, sugar: 50, sodium: 2300, water: 2500 });

describe('goalFor (past days keep the goal they had)', () => {
  const snaps = { '2026-11-10': T(2400) };
  it('uses the saved goal for a past day', () => expect(goalFor('2026-11-10', '2026-11-18', snaps, T(2200)).kcal).toBe(2400));
  it('always uses the current goal for today', () => expect(goalFor('2026-11-18', '2026-11-18', { '2026-11-18': T(1), ...snaps }, T(2200)).kcal).toBe(2200));
  it('falls back to the current goal for a past day with no snapshot', () => expect(goalFor('2026-11-01', '2026-11-18', snaps, T(2200)).kcal).toBe(2200));
});

describe('backupDue', () => {
  const day = 86400000;
  const now = 100 * day;
  it('is not due in the first week of using the app', () => expect(backupDue(undefined, now - 3 * day, now)).toBe(false));
  it('is due after a week with no backup', () => expect(backupDue(undefined, now - 8 * day, now)).toBe(true));
  it('is not due within 7 days of the last backup', () => expect(backupDue(now - 2 * day, now - 30 * day, now)).toBe(false));
  it('is due 7 days after the last backup', () => expect(backupDue(now - 7.5 * day, now - 30 * day, now)).toBe(true));
});

describe('orphanPhotoIds', () => {
  it('finds photos nothing points at', () => {
    expect(orphanPhotoIds([1, 2, 3, 4], [{ photoId: 1 }, { photoId: undefined }], [{ photoId: 3 }], [{ photoId: 1 }])).toEqual([2, 4]);
  });
});

describe('backup restore safety', () => {
  const data = {
    settings: [{ id: 'me' }],
    entries: [{ date: '2026-11-18', createdAt: 1, photoId: 5 }],
    saved: [{ name: 'x', photoId: 5 }],
    progressPhotos: [{ date: '2026-11-18', photoId: 5 }],
  };
  it('detaches photo links when the backup has no photos', () => {
    const out = detachPhotos(data as any);
    expect(out.entries[0].photoId).toBeUndefined();
    expect(out.saved[0].photoId).toBeUndefined();
    expect(out.progressPhotos).toEqual([]);
  });
  it('accepts a well-formed backup', () => expect(() => validateBackup(data)).not.toThrow());
  it('rejects backups with broken tables', () => {
    expect(() => validateBackup({ ...data, entries: 'nope' })).toThrow();
    expect(() => validateBackup({ ...data, entries: [{ createdAt: 1 }] })).toThrow();
    expect(() => validateBackup({ ...data, settings: [] })).toThrow();
  });
});
