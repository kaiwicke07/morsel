import { db, type Settings } from './db';
import { DEFAULT_RELAY } from './garminSync';
import { base64ToBlob, blobToBase64 } from './image';
import { detachPhotos, validateBackup } from './maintenance';

/** API keys never leave the device in a backup file. */
export function stripSecrets(s: Settings): Settings {
  return { ...s, usdaKey: '', ai: { ...s.ai, claudeKey: '', geminiKey: '' }, garmin: s.garmin ? { ...s.garmin, code: '' } : undefined };
}

/** On import, keep whatever keys this device already has; never take keys from a file. */
export function keepLocalSecrets(imported: Settings, local: Settings | undefined): Settings {
  return {
    ...imported,
    usdaKey: local?.usdaKey ?? '',
    ai: { ...imported.ai, claudeKey: local?.ai.claudeKey ?? '', geminiKey: local?.ai.geminiKey ?? '' },
    // the sync code and the address it is sent to only ever come from this device
    garmin: imported.garmin
      ? { ...imported.garmin, code: local?.garmin?.code ?? '', relayUrl: local?.garmin?.relayUrl ?? DEFAULT_RELAY }
      : local?.garmin,
  };
}

const TABLES = ['settings', 'entries', 'exercises', 'water', 'weights', 'saved', 'progressPhotos', 'dayGoals'] as const;

export async function exportBackup(includePhotos: boolean): Promise<Blob> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  data.settings = (data.settings as Settings[]).map(stripSecrets);
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
  validateBackup(parsed.data);
  let data = parsed.data as Record<string, any[]>;
  if (!Array.isArray(data.photos)) data = detachPhotos(data);
  const local = await db.settings.get('me');
  if (Array.isArray(data.settings)) data.settings = data.settings.map((s: Settings) => keepLocalSecrets(s, local));
  await db.transaction('rw', db.tables, async () => {
    for (const t of TABLES) {
      if (!Array.isArray(data[t])) continue;
      await db.table(t).clear();
      await db.table(t).bulkAdd(data[t]);
    }
    // photos always follow the backup: either its own, or none
    await db.photos.clear();
    if (Array.isArray(data.photos)) {
      await db.photos.bulkAdd(
        data.photos.map(p => ({ id: p.id, createdAt: p.createdAt, full: base64ToBlob(p.full), thumb: base64ToBlob(p.thumb) })),
      );
    }
  });
}
