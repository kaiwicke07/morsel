import { db } from './db';
import { base64ToBlob, blobToBase64 } from './image';

const TABLES = ['settings', 'entries', 'exercises', 'water', 'weights', 'saved', 'progressPhotos'] as const;

export async function exportBackup(includePhotos: boolean): Promise<Blob> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  if (includePhotos) {
    const photos = await db.photos.toArray();
    data.photos = await Promise.all(
      photos.map(async p => ({ id: p.id, createdAt: p.createdAt, full: await blobToBase64(p.full), thumb: await blobToBase64(p.thumb) })),
    );
  }
  const out = { app: 'morsel', version: 1, exportedAt: new Date().toISOString(), data };
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

export async function importBackup(file: Blob): Promise<void> {
  const parsed = JSON.parse(await file.text());
  if (parsed?.app !== 'morsel' || !parsed.data) throw new Error("That file isn't a Morsel backup.");
  const data = parsed.data as Record<string, any[]>;
  await db.transaction('rw', db.tables, async () => {
    for (const t of TABLES) {
      if (!Array.isArray(data[t])) continue;
      await db.table(t).clear();
      await db.table(t).bulkAdd(data[t]);
    }
    if (Array.isArray(data.photos)) {
      await db.photos.clear();
      await db.photos.bulkAdd(
        data.photos.map(p => ({ id: p.id, createdAt: p.createdAt, full: base64ToBlob(p.full), thumb: base64ToBlob(p.thumb) })),
      );
    }
  });
}
