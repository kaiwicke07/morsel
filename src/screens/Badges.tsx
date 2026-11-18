import { useLiveQuery } from 'dexie-react-hooks';
import { baseTargets } from '../data';
import { BADGES, earnedBadges, type BadgeStats } from '../lib/badges';
import { db } from '../lib/db';
import { entryTotals } from '../lib/day';
import { bestStreak } from '../lib/streak';
import { goalFor } from '../lib/maintenance';
import { todayIso } from '../lib/units';
import { useNav } from '../nav';
import { Screen } from '../ui/primitives';

export function useBadgeStats(): BadgeStats | undefined {
  return useLiveQuery(async () => {
    const [entries, water, weights, s, goals] = await Promise.all([db.entries.toArray(), db.water.toArray(), db.weights.orderBy('createdAt').toArray(), db.settings.get('me'), db.dayGoals.toArray()]);
    if (!s) return undefined;
    const t = baseTargets(s);
    const snaps = Object.fromEntries(goals.map(g => [g.date, g.targets]));
    const today = todayIso();
    const perDay = new Map<string, { n: number; kcal: number }>();
    for (const e of entries) {
      if (e.status !== 'ready') continue;
      const d = perDay.get(e.date) ?? { n: 0, kcal: 0 };
      d.n++;
      d.kcal += entryTotals(e).kcal;
      perDay.set(e.date, d);
    }
    const waterDay = new Map<string, number>();
    for (const w of water) waterDay.set(w.date, (waterDay.get(w.date) || 0) + w.ml);
    const first = weights[0]?.kg ?? s.profile.weightKg;
    const lowest = weights.length ? Math.min(...weights.map(w => w.kg)) : first;
    return {
      bestStreak: bestStreak(new Set(perDay.keys())),
      totalMeals: entries.filter(e => e.status === 'ready').length,
      maxMealsInDay: Math.max(0, ...[...perDay.values()].map(d => d.n)),
      daysOnTarget: [...perDay.entries()].filter(([date, d]) => { const g = goalFor(date, today, snaps, t).kcal; return Math.abs(d.kcal - g) <= g * 0.1; }).length,
      waterDays: [...waterDay.values()].filter(ml => ml >= t.water).length,
      kgLost: Math.max(0, first - lowest),
      weighIns: weights.length,
    };
  }, []);
}

export function Badges() {
  const nav = useNav();
  const stats = useBadgeStats();
  const earned = new Set(stats ? earnedBadges(stats).map(b => b.id) : []);
  return (
    <Screen title="Badges" onClose={nav.pop}>
      {() => (
        <div className="page">
          <p className="muted" style={{ marginTop: 4 }}>{earned.size} of {BADGES.length} earned. They come from showing up, not from eating less.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {BADGES.map(b => {
              const on = earned.has(b.id);
              return (
                <div key={b.id} className="card" style={{ padding: '16px 10px', textAlign: 'center', opacity: on ? 1 : 0.5, boxShadow: on ? 'var(--shadow)' : 'none', background: on ? 'var(--card)' : 'var(--card-2)' }}>
                  <div
                    className="num"
                    style={{
                      width: 54,
                      height: 54,
                      margin: '0 auto 10px',
                      borderRadius: 16,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 22,
                      fontWeight: 700,
                      background: on ? 'var(--accent)' : 'transparent',
                      color: on ? 'var(--accent-ink)' : 'var(--ink-3)',
                      border: on ? 'none' : '1.5px dashed var(--ink-3)',
                      transform: on ? 'rotate(-4deg)' : 'none',
                    }}
                  >
                    {b.glyph}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{b.title}</div>
                  <div className="small muted" style={{ fontSize: 12 }}>{b.detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Screen>
  );
}
