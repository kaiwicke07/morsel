// Private relay between Morsel (on the phone) and the Garmin Connect Personal API.
// Garmin blocks browser calls (no CORS), and the Garmin key must not live in the web app.
// GET /api/garmin?start=YYYY-MM-DD&end=YYYY-MM-DD  with header  x-morsel-code: <sync code>
import { codeMatches, normalizeActivities, normalizeDays, validRange } from '../lib/normalize.js';

const BASE = 'https://personal.connectapi.garmin.com';
const ALLOWED = ['https://kaiwicke07.github.io', 'http://127.0.0.1:5199', 'http://localhost:5173'];

let cached = { token: '', exp: 0 }; // survives while the function instance stays warm

async function token() {
  if (cached.token && cached.exp - Date.now() > 3600_000) return cached.token;
  const r = await fetch(`${BASE}/personalapitoken-service/personal-api/personal-api-key/token`, {
    method: 'POST',
    headers: { Accept: '*/*', Authorization: `ApiKey ${process.env.GARMIN_KEY}` },
  });
  if (!r.ok) throw Object.assign(new Error('garmin_key_rejected'), { status: r.status });
  const t = (await r.text()).trim();
  const payload = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
  cached = { token: t, exp: payload.exp * 1000 };
  return t;
}

async function garmin(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' } });
  if (r.status === 401) cached = { token: '', exp: 0 };
  if (!r.ok) throw Object.assign(new Error(`garmin_${r.status}`), { status: r.status });
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'x-morsel-code');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  if (!codeMatches(req.headers['x-morsel-code'], process.env.MORSEL_SYNC_CODE)) return res.status(401).json({ error: 'bad_code' });

  const { start, end } = req.query;
  if (!validRange(start, end)) return res.status(400).json({ error: 'bad_range' });

  try {
    const [summaries, steps, activities] = await Promise.all([
      garmin(`/usersummary-service/v2/dailysummaries?startDate=${start}&endDate=${end}`),
      garmin(`/usersummary-service/stats/steps/daily/${start}/${end}`),
      garmin(`/activitylist-service/activities/search/activities?start=0&limit=100&startDate=${start}&endDate=${end}`),
    ]);
    return res.status(200).json({ days: normalizeDays(summaries, steps), activities: normalizeActivities(activities), fetchedAt: Date.now() });
  } catch (e) {
    const rejected = e.message === 'garmin_key_rejected';
    return res.status(502).json({ error: rejected ? 'garmin_key_rejected' : 'garmin_unavailable', status: e.status ?? null });
  }
}
