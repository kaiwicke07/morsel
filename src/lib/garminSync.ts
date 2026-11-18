import { db } from './db';
import type { GarminActivity, GarminDay } from './garmin';
import { addDays, todayIso } from './units';

export const DEFAULT_RELAY = 'https://morsel-garmin.vercel.app';
const MIN_INTERVAL = 10 * 60_000;
let running: Promise<void> | null = null;

export class GarminError extends Error {}

/** Ask the relay for the last two weeks and store it. Throttled unless forced. */
export async function syncGarmin(force = false): Promise<void> {
  if (running) return running;
  running = (async () => {
    const s = await db.settings.get('me');
    const g = s?.garmin;
    if (!g?.enabled || !g.code) return;
    if (!force && g.lastSync && Date.now() - g.lastSync < MIN_INTERVAL) return;
    const end = todayIso();
    const start = addDays(end, -13);
    let res: Response;
    try {
      res = await fetch(`${g.relayUrl || DEFAULT_RELAY}/api/garmin?start=${start}&end=${end}`, { headers: { 'x-morsel-code': g.code } });
    } catch {
      await setStatus({ lastError: "Can't reach the Garmin relay. Check your connection." });
      throw new GarminError("Can't reach the Garmin relay.");
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        body.error === 'bad_code' ? 'That sync code is wrong.'
        : body.error === 'garmin_key_rejected' ? 'Garmin rejected the key. It may have expired; make a new one in Garmin Connect.'
        : 'Garmin is not answering right now. Try again later.';
      await setStatus({ lastError: msg });
      throw new GarminError(msg);
    }
    const days = body.days as GarminDay[];
    const acts = body.activities as GarminActivity[];
    await db.transaction('rw', db.garminDays, db.garminActivities, async () => {
      await db.garminDays.bulkPut(days);
      // replace the window's activities so deleted workouts disappear
      await db.garminActivities.where('date').between(start, end, true, true).delete();
      await db.garminActivities.bulkPut(acts);
    });
    await setStatus({ lastSync: Date.now(), lastError: undefined });
  })();
  try {
    await running;
  } finally {
    running = null;
  }
}

async function setStatus(patch: { lastSync?: number; lastError?: string }) {
  const s = await db.settings.get('me');
  if (s?.garmin) await db.settings.update('me', { garmin: { ...s.garmin, ...patch } });
}
