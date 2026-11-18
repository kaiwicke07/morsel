import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { baseTargets, useCurrentWeight, useLoggedDays, useSettings } from '../data';
import { earnedBadges, BADGES } from '../lib/badges';
import { db, type Settings, type WeightEntry } from '../lib/db';
import { entryTotals } from '../lib/day';
import { bmi, bmiBand, goalDate } from '../lib/plan';
import { bestStreak, currentStreak } from '../lib/streak';
import { addDays, kgToLb, parseIso, todayIso } from '../lib/units';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { SegTabs } from '../ui/primitives';
import { useBadgeStats } from './Badges';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Progress() {
  const s = useSettings();
  const logged = useLoggedDays();
  const stats = useBadgeStats();
  const nav = useNav();
  if (!s) return null;
  const streak = currentStreak(logged, todayIso());
  const best = bestStreak(logged);
  const earned = stats ? earnedBadges(stats).length : 0;

  return (
    <div className="page">
      <h1 className="serif" style={{ fontSize: 34, fontWeight: 600, margin: '6px 0 16px' }}>Progress</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="tiny faint">Streak</div>
          <div className="num" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1 }}>{streak}<span className="muted small" style={{ fontFamily: 'var(--sans)' }}> days</span></div>
          <div className="small muted">Best {best}</div>
        </div>
        <button className="card" style={{ textAlign: 'left' }} onClick={() => nav.push({ kind: 'badges' })}>
          <div className="tiny faint">Badges</div>
          <div className="num" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1 }}>{earned}<span className="muted small" style={{ fontFamily: 'var(--sans)' }}> / {BADGES.length}</span></div>
          <div className="small muted row" style={{ gap: 4 }}>See all <Icon name="next" size={14} /></div>
        </button>
      </div>

      <WeightSection s={s} />
      <NutritionSection s={s} />

      <button className="card row" style={{ width: '100%', marginTop: 12, textAlign: 'left' }} onClick={() => nav.push({ kind: 'photos' })}>
        <Icon name="photo" />
        <span style={{ flex: 1 }}>
          <b>Progress photos</b>
          <span className="small muted" style={{ display: 'block' }}>Private, stored only on this phone</span>
        </span>
        <Icon name="next" />
      </button>
    </div>
  );
}

const RANGES = [
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '180', label: '6M' },
  { value: '365', label: '1Y' },
  { value: 'all', label: 'All' },
] as const;

function WeightSection({ s }: { s: Settings }) {
  const nav = useNav();
  const imperial = s.profile.units === 'imperial';
  const conv = (kg: number) => (imperial ? kgToLb(kg) : kg);
  const unit = imperial ? 'lb' : 'kg';
  const weights = useLiveQuery(() => db.weights.orderBy('createdAt').toArray(), []);
  const current = useCurrentWeight(s) ?? s.profile.weightKg;
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('90');
  const start = weights?.[0]?.kg ?? current;
  const goal = s.profile.goalWeightKg;
  const total = Math.abs(goal - start);
  const done = s.profile.goal === 'maintain' ? 1 : total > 0 ? Math.max(0, Math.min(1, (s.profile.goal === 'lose' ? start - current : current - start) / total)) : 1;
  const eta = goalDate({ ...s.profile, weightKg: current });
  const b = bmi(current, s.profile.heightCm);

  const cutoff = range === 'all' ? '' : addDays(todayIso(), -Number(range));
  const shown = (weights ?? []).filter(w => w.date >= cutoff);

  return (
    <>
      <h2 className="section-title">Weight</h2>
      <div className="card">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="tiny faint">Current</div>
            <div className="num" style={{ fontSize: 44, fontWeight: 600, lineHeight: 1 }}>
              {conv(current).toFixed(1)}
              <span className="muted" style={{ fontSize: 16, fontFamily: 'var(--sans)' }}> {unit}</span>
            </div>
          </div>
          <button className="btn sm" onClick={() => nav.push({ kind: 'weight' })}>
            <Icon name="plus" size={18} /> Log weight
          </button>
        </div>
        {s.profile.goal !== 'maintain' && (
          <>
            <div className="meter" style={{ height: 8, marginTop: 16 }}>
              <span style={{ transform: `scaleX(${done})`, background: 'var(--accent)' }} />
            </div>
            <div className="row between small muted" style={{ marginTop: 6 }}>
              <span>Start {conv(start).toFixed(1)}</span>
              <span>{Math.round(done * 100)}%</span>
              <span>Goal {conv(goal).toFixed(1)}</span>
            </div>
            {eta && done < 1 && <div className="small muted" style={{ marginTop: 8 }}>At your pace: around <b style={{ color: 'var(--ink)' }}>{eta.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</b></div>}
          </>
        )}
        <div style={{ marginTop: 16 }}>
          <SegTabs value={range} onChange={setRange} options={RANGES.map(r => ({ value: r.value, label: r.label }))} />
        </div>
        <WeightChart rows={shown} conv={conv} unit={unit} goal={s.profile.goal === 'maintain' ? undefined : conv(goal)} />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row between">
          <span style={{ fontWeight: 600 }}>BMI</span>
          <span>
            <span className="num" style={{ fontSize: 26, fontWeight: 600 }}>{b.toFixed(1)}</span>{' '}
            <span className="chip" style={{ minHeight: 26, fontSize: 13, padding: '0 10px', marginLeft: 6 }}>{bmiBand(b)}</span>
          </span>
        </div>
        <BmiScale v={b} />
        <p className="small faint" style={{ margin: '8px 0 0' }}>BMI ignores muscle mass, so treat it as a rough guide.</p>
      </div>
    </>
  );
}

function BmiScale({ v }: { v: number }) {
  const lo = 15, hi = 35;
  const bands = [
    { to: 18.5, label: 'Under' },
    { to: 25, label: 'Healthy' },
    { to: 30, label: 'Over' },
    { to: 35, label: 'Obese' },
  ];
  const pos = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  let prev = lo;
  return (
    <div style={{ position: 'relative', marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 2, height: 10 }}>
        {bands.map(b => {
          const w = (b.to - prev) / (hi - lo);
          prev = b.to;
          return <span key={b.label} style={{ flex: `${w} 0 0`, borderRadius: 4, background: b.label === 'Healthy' ? 'var(--good)' : 'var(--card-2)', opacity: b.label === 'Healthy' ? 0.7 : 1 }} />;
        })}
      </div>
      <span style={{ position: 'absolute', top: -4, left: `calc(${pos * 100}% - 2px)`, width: 4, height: 18, borderRadius: 2, background: 'var(--ink)', boxShadow: '0 0 0 2px var(--card)' }} />
      <div className="row between tiny faint" style={{ marginTop: 6 }}>
        {bands.map(b => <span key={b.label}>{b.label}</span>)}
      </div>
    </div>
  );
}

function WeightChart({ rows, conv, unit, goal }: { rows: WeightEntry[]; conv: (kg: number) => number; unit: string; goal?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 180, padL = 36, padR = 10, padT = 14, padB = 24;

  // one point per day (last weigh-in wins)
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.date, conv(r.kg));
  const pts = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, v]) => ({ d, t: parseIso(d).getTime(), v }));

  if (pts.length < 2)
    return (
      <div ref={ref} className="small muted" style={{ height: 120, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        Log your weight on a couple of days to see the trend.
      </div>
    );

  const vals = pts.map(p => p.v).concat(goal !== undefined ? [goal] : []);
  let min = Math.min(...vals), max = Math.max(...vals);
  const pad = Math.max(1, (max - min) * 0.15);
  min = Math.floor(min - pad);
  max = Math.ceil(max + pad);
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const x = (t: number) => padL + ((t - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const ticks = [min, (min + max) / 2, max];
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${path}L${x(t1)},${H - padB}L${x(t0)},${H - padB}Z`;
  const hp = hover !== null ? pts[hover] : null;

  const onMove = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(x(pts[i].t) - px) < Math.abs(x(pts[best].t) - px)) best = i;
    setHover(best);
  };

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 12 }}>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label={`Weight from ${pts[0].v.toFixed(1)} to ${pts[pts.length - 1].v.toFixed(1)} ${unit}`}
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={e => onMove(e.clientX, e.currentTarget)}
        onPointerDown={e => onMove(e.clientX, e.currentTarget)}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="wfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" fontFamily="var(--sans)">{Math.round(t)}</text>
          </g>
        ))}
        {goal !== undefined && goal >= min && goal <= max && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(goal)} y2={y(goal)} stroke="var(--ink-2)" strokeDasharray="4 4" strokeWidth="1.5" />
            <text x={W - padR} y={y(goal) - 5} textAnchor="end" fontSize="11" fill="var(--ink-2)" fontFamily="var(--sans)">goal</text>
          </g>
        )}
        <path d={area} fill="url(#wfill)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.length <= 40 && pts.map(p => <circle key={p.d} cx={x(p.t)} cy={y(p.v)} r="3" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />)}
        <text x={padL} y={H - 6} fontSize="11" fill="var(--ink-3)" fontFamily="var(--sans)">{parseIso(pts[0].d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="11" fill="var(--ink-3)" fontFamily="var(--sans)">{parseIso(pts[pts.length - 1].d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>
        {hp && (
          <g>
            <line x1={x(hp.t)} x2={x(hp.t)} y1={padT} y2={H - padB} stroke="var(--ink-3)" strokeWidth="1" />
            <circle cx={x(hp.t)} cy={y(hp.v)} r="5" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hp && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: Math.min(W - 120, Math.max(0, x(hp.t) - 60)),
            width: 120,
            textAlign: 'center',
            background: 'var(--ink)',
            color: 'var(--paper)',
            borderRadius: 10,
            padding: '6px 8px',
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          <b className="num">{hp.v.toFixed(1)} {unit}</b>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{parseIso(hp.d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
        </div>
      )}
    </div>
  );
}

const WEEKS = [
  { value: '0', label: 'This wk' },
  { value: '1', label: 'Last wk' },
  { value: '2', label: '2 wks ago' },
  { value: '3', label: '3 wks ago' },
] as const;

function NutritionSection({ s }: { s: Settings }) {
  const [week, setWeek] = useState<(typeof WEEKS)[number]['value']>('0');
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const today = todayIso();
  const sel = parseIso(today);
  const monday = addDays(addDays(today, -((sel.getDay() + 6) % 7)), -7 * Number(week));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const target = baseTargets(s).kcal;

  const data = useLiveQuery(async () => {
    const rows = await db.entries.where('date').between(days[0], days[6], true, true).toArray();
    return days.map(d => {
      const t = { p: 0, c: 0, f: 0, kcal: 0 };
      for (const r of rows) {
        if (r.date !== d || r.status !== 'ready') continue;
        const n = entryTotals(r);
        t.p += n.protein * 4;
        t.c += n.carbs * 4;
        t.f += n.fat * 9;
        t.kcal += n.kcal;
      }
      return { d, ...t };
    });
  }, [monday]);

  const H = 190, padL = 36, padB = 24, padT = 12;
  const logged = (data ?? []).filter(x => x.kcal > 0);
  const avg = logged.length ? Math.round(logged.reduce((n, x) => n + x.kcal, 0) / logged.length) : 0;
  const max = Math.max(target * 1.2, ...(data ?? []).map(x => Math.max(x.kcal, x.p + x.c + x.f)));
  const yy = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const slot = (W - padL) / 7;
  const bw = Math.min(28, slot * 0.55);
  const series = [
    { k: 'p' as const, label: 'Protein', c: 'var(--protein)' },
    { k: 'c' as const, label: 'Carbs', c: 'var(--carbs)' },
    { k: 'f' as const, label: 'Fat', c: 'var(--fat)' },
  ];
  const hd = hover !== null && data ? data[hover] : null;

  return (
    <>
      <h2 className="section-title">Nutrition</h2>
      <div className="card">
        <SegTabs value={week} onChange={v => { setWeek(v); setHover(null); }} options={WEEKS.map(w => ({ value: w.value, label: w.label }))} />
        <div className="row between" style={{ marginTop: 14 }}>
          <div>
            <div className="tiny faint">Daily average</div>
            <div className="num" style={{ fontSize: 30, fontWeight: 600 }}>{avg.toLocaleString()} <span className="small muted" style={{ fontFamily: 'var(--sans)' }}>cal</span></div>
          </div>
          <div className="small muted" style={{ textAlign: 'right' }}>
            {logged.length} of 7 days logged
            <br />
            target {target.toLocaleString()}
          </div>
        </div>
        <div className="row" style={{ gap: 14, marginTop: 10 }}>
          {series.map(x => (
            <span key={x.k} className="row small muted" style={{ gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: x.c }} />
              {x.label}
            </span>
          ))}
        </div>
        <div ref={ref} style={{ position: 'relative', marginTop: 8 }}>
          <svg width={W} height={H} role="img" aria-label={`Calories by day, average ${avg}`} style={{ display: 'block' }} onPointerLeave={() => setHover(null)}>
            {[0, target].map(t => (
              <g key={t}>
                <line x1={padL} x2={W} y1={yy(t)} y2={yy(t)} stroke={t ? 'var(--ink-2)' : 'var(--line)'} strokeDasharray={t ? '4 4' : undefined} />
                <text x={padL - 6} y={yy(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" fontFamily="var(--sans)">{t ? `${(t / 1000).toFixed(1)}k` : '0'}</text>
              </g>
            ))}
            {(data ?? []).map((x, i) => {
              const cx = padL + slot * i + slot / 2;
              let acc = 0;
              const segs = series.map(se => {
                const v = x[se.k];
                const y0 = yy(acc), y1 = yy(acc + v);
                acc += v;
                return { ...se, y: y1, h: Math.max(0, y0 - y1 - (v > 0 ? 2 : 0)) };
              });
              const top = segs.filter(sg => sg.h > 0).pop();
              return (
                <g key={x.d} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} style={{ cursor: 'pointer' }}>
                  <rect x={cx - slot / 2} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
                  {segs.map(sg =>
                    sg.h > 0 ? (
                      <rect key={sg.k} x={cx - bw / 2} y={sg.y} width={bw} height={sg.h} fill={sg.c} rx={sg === top ? 4 : 0} opacity={hover === null || hover === i ? 1 : 0.45} />
                    ) : null,
                  )}
                  <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill={x.d === today ? 'var(--ink)' : 'var(--ink-3)'} fontWeight={x.d === today ? 700 : 400} fontFamily="var(--sans)">
                    {parseIso(x.d).toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </text>
                </g>
              );
            })}
          </svg>
          {hd && hd.kcal > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: Math.min(W - 150, Math.max(0, padL + slot * hover! + slot / 2 - 75)),
                width: 150,
                background: 'var(--ink)',
                color: 'var(--paper)',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 13,
                pointerEvents: 'none',
              }}
            >
              <b>{parseIso(hd.d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</b>
              <div className="num" style={{ fontSize: 16 }}>{Math.round(hd.kcal).toLocaleString()} cal</div>
              <div style={{ opacity: 0.75 }}>P {Math.round(hd.p / 4)}g · C {Math.round(hd.c / 4)}g · F {Math.round(hd.f / 9)}g</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
