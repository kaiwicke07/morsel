import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { baseTargets, logWater, runAnalysis, useDay, useLoggedDays, usePhoto, useSettings, type DayData } from '../data';
import { db, type Settings } from '../lib/db';
import { entryTotals } from '../lib/day';
import { currentStreak } from '../lib/streak';
import type { ExerciseEntry, FoodEntry } from '../lib/types';
import { addDays, parseIso, todayIso } from '../lib/units';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { Meter, Thumb } from '../ui/primitives';
import { Logo } from './Onboarding';

const fmt = (n: number) => Math.round(n).toLocaleString();

export function Home() {
  const s = useSettings();
  const nav = useNav();
  const day = useDay(nav.date, s);
  const logged = useLoggedDays();
  const streak = currentStreak(logged, todayIso());
  const hasKey = !!s && (s.ai.provider === 'gemini' ? !!s.ai.geminiKey : !!s.ai.claudeKey);
  if (!s) return null;

  return (
    <div className="page">
      <header className="row between" style={{ padding: '6px 0 10px' }}>
        <div className="row" style={{ gap: 10 }}>
          <Logo size={28} />
          <span className="serif" style={{ fontSize: 24, fontWeight: 600 }}>Morsel</span>
        </div>
        <button className="chip" onClick={() => nav.push({ kind: 'badges' })} aria-label={`${streak} day streak`}>
          <StreakMark lit={logged.has(todayIso())} />
          <span className="num" style={{ fontWeight: 600 }}>{streak}</span>
        </button>
      </header>

      <WeekStrip s={s} />

      {day ? <SummaryPager day={day} s={s} /> : <div className="card skeleton" style={{ height: 268 }} />}

      {!hasKey && (
        <button className="card row" style={{ width: '100%', marginTop: 12, textAlign: 'left', border: '1.5px dashed var(--accent)', boxShadow: 'none', background: 'transparent' }} onClick={() => nav.push({ kind: 'ai' })}>
          <Icon name="key" />
          <span style={{ flex: 1 }}>
            <b>Turn on photo scanning</b>
            <span className="small muted" style={{ display: 'block' }}>Add your Claude (or Gemini) API key. Barcode and search work without it.</span>
          </span>
          <Icon name="next" />
        </button>
      )}

      <h2 className="section-title">{nav.date === todayIso() ? 'Today' : parseIso(nav.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>
      {day && <DayList day={day} />}
    </div>
  );
}

function StreakMark({ lit }: { lit: boolean }) {
  // a tally-mark bundle: four strokes and a slash
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      {[4, 8, 12, 16].map(x => (
        <path key={x} d={`M${x} 4v12`} stroke={lit ? 'var(--accent)' : 'var(--ink-3)'} strokeWidth="2" strokeLinecap="round" />
      ))}
      <path d="M2 14L18 6" stroke={lit ? 'var(--accent)' : 'var(--ink-3)'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WeekStrip({ s }: { s: Settings }) {
  const nav = useNav();
  const today = todayIso();
  // Monday-start week containing the selected date
  const sel = parseIso(nav.date);
  const monday = addDays(nav.date, -((sel.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const base = baseTargets(s).kcal;
  const totals = useLiveQuery(async () => {
    const rows = await db.entries.where('date').between(days[0], days[6], true, true).toArray();
    const m: Record<string, number> = {};
    for (const r of rows) if (r.status === 'ready') m[r.date] = (m[r.date] || 0) + entryTotals(r).kcal;
    return m;
  }, [monday]);

  return (
    <div className="row" style={{ gap: 4, margin: '4px -4px 14px' }}>
      <button className="icon-btn flat" style={{ width: 28 }} aria-label="Previous week" onClick={() => nav.setDate(addDays(monday, -7))}>
        <Icon name="back" size={18} />
      </button>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {days.map(d => {
          const future = d > today;
          const selected = d === nav.date;
          const k = Math.min(1, (totals?.[d] || 0) / base);
          const dt = parseIso(d);
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => nav.setDate(d)}
              aria-pressed={selected}
              aria-label={dt.toDateString()}
              style={{
                display: 'grid',
                justifyItems: 'center',
                gap: 4,
                padding: '8px 0 6px',
                borderRadius: 14,
                background: selected ? 'var(--ink)' : 'transparent',
                color: selected ? 'var(--paper)' : future ? 'var(--ink-3)' : 'var(--ink)',
                transition: 'background 160ms',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{dt.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              <span className="num" style={{ fontSize: 17, fontWeight: 600 }}>{dt.getDate()}</span>
              <span style={{ width: 18, height: 4, borderRadius: 4, background: selected ? 'rgba(255,255,255,.25)' : 'var(--line)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${k * 100}%`, background: d === today && !selected ? 'var(--accent)' : selected ? 'var(--paper)' : 'var(--ink-2)' }} />
              </span>
            </button>
          );
        })}
      </div>
      <button
        className="icon-btn flat"
        style={{ width: 28, opacity: addDays(monday, 7) > today ? 0.25 : 1 }}
        aria-label="Next week"
        disabled={addDays(monday, 7) > today}
        onClick={() => nav.setDate(addDays(monday, 7) > today ? today : addDays(monday, 7))}
      >
        <Icon name="next" size={18} />
      </button>
    </div>
  );
}

function SummaryPager({ day, s }: { day: DayData; s: Settings }) {
  const [page, setPage] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = ref.current!;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  return (
    <div>
      <div
        ref={ref}
        onScroll={onScroll}
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', margin: '0 -16px', padding: '2px 16px 14px', gap: 12 }}
      >
        <CaloriesCard day={day} s={s} />
        <DetailCard day={day} />
        <WaterCard day={day} s={s} />
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 6 }} aria-hidden="true">
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 6, background: i === page ? 'var(--ink)' : 'var(--line)', transition: 'width 240ms var(--ease-out)' }} />
        ))}
      </div>
    </div>
  );
}

const pageStyle = { flex: '0 0 100%', scrollSnapAlign: 'center', minHeight: 268 } as const;

function CaloriesCard({ day, s }: { day: DayData; s: Settings }) {
  const left = day.targets.kcal - day.eaten.kcal;
  const over = left < 0;
  const macros = [
    { k: 'Protein', v: day.eaten.protein, t: day.targets.protein, c: 'var(--protein)' },
    { k: 'Carbs', v: day.eaten.carbs, t: day.targets.carbs, c: 'var(--carbs)' },
    { k: 'Fat', v: day.eaten.fat, t: day.targets.fat, c: 'var(--fat)' },
  ];
  return (
    <section className="card" style={pageStyle} aria-label="Calories">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="num" style={{ fontSize: 58, fontWeight: 600, lineHeight: 0.95, color: over ? 'var(--bad)' : 'var(--ink)' }}>{fmt(Math.abs(left))}</div>
          <div className="muted" style={{ marginTop: 6 }}>{over ? 'calories over' : 'calories left'}</div>
        </div>
        <div style={{ textAlign: 'right' }} className="small muted">
          <div>
            <span className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt(day.eaten.kcal)}</span> eaten
          </div>
          <div>
            of <span className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt(day.targets.kcal)}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <Meter value={day.eaten.kcal} max={day.targets.kcal} color={over ? 'var(--bad)' : 'var(--accent)'} height={12} />
      </div>
      {(day.burned > 0 || day.rollover > 0) && (
        <div className="row small muted" style={{ gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          {day.burned > 0 && <span>{s.profile.addBurned ? '+' : ''}{fmt(day.burned)} burned{s.profile.addBurned ? '' : ' (not added)'}</span>}
          {day.rollover > 0 && <span>+{fmt(day.rollover)} rolled over</span>}
        </div>
      )}
      <div className="stack" style={{ marginTop: 18, gap: 14 }}>
        {macros.map(m => {
          const l = m.t - m.v;
          return (
            <div key={m.k}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span className="row" style={{ gap: 8, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: m.c }} />
                  {m.k}
                </span>
                <span className="small muted">
                  <span className="num" style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 15 }}>{fmt(Math.abs(l))}g</span> {l < 0 ? 'over' : 'left'}
                </span>
              </div>
              <Meter value={m.v} max={m.t} color={m.c} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DetailCard({ day }: { day: DayData }) {
  const rows = [
    { k: 'Fiber', v: day.eaten.fiber, t: day.targets.fiber, u: 'g', goal: 'min' as const },
    { k: 'Sugar', v: day.eaten.sugar, t: day.targets.sugar, u: 'g', goal: 'max' as const },
    { k: 'Sodium', v: day.eaten.sodium, t: day.targets.sodium, u: 'mg', goal: 'max' as const },
  ];
  const hs = day.healthScore;
  return (
    <section className="card" style={pageStyle} aria-label="Fiber, sugar, sodium and health score">
      <div className="stack" style={{ gap: 16 }}>
        {rows.map(r => {
          const bad = r.goal === 'max' && r.v > r.t;
          const l = r.t - r.v;
          return (
            <div key={r.k}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{r.k}</span>
                <span className="small muted">
                  <span className="num" style={{ color: bad ? 'var(--bad)' : 'var(--ink)', fontWeight: 600, fontSize: 15 }}>
                    {fmt(Math.abs(l))}
                    {r.u}
                  </span>{' '}
                  {r.goal === 'min' ? (l > 0 ? 'to go' : 'past goal') : l >= 0 ? 'left' : 'over'}
                </span>
              </div>
              <Meter value={r.v} max={r.t} color={bad ? 'var(--bad)' : 'var(--ink-2)'} />
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <div className="row between">
          <span style={{ fontWeight: 600 }}>Health score</span>
          <span className="num" style={{ fontSize: 26, fontWeight: 600 }}>
            {hs ? hs.toFixed(1) : '–'}
            <span className="muted" style={{ fontSize: 15 }}>/10</span>
          </span>
        </div>
        <ScoreBar v={hs} />
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          {hs === 0 ? 'Log a meal to see how the day scores.' : hs >= 7.5 ? 'Mostly whole foods. Nice.' : hs >= 5 ? 'A mixed day. More plants and protein would lift it.' : 'Heavy on processed food today.'}
        </p>
      </div>
    </section>
  );
}

export function ScoreBar({ v }: { v: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: 3, marginTop: 8 }} aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ height: 8, borderRadius: 3, background: i < Math.round(v) ? (v >= 7 ? 'var(--good)' : v >= 4 ? 'var(--carbs)' : 'var(--bad)') : 'var(--card-2)' }} />
      ))}
    </div>
  );
}

function WaterCard({ day, s }: { day: DayData; s: Settings }) {
  const nav = useNav();
  const imperial = s.profile.units === 'imperial';
  const cup = imperial ? 236.6 : 250;
  const goal = day.targets.water;
  const cups = Math.ceil(goal / cup);
  const filled = Math.floor(day.waterMl / cup + 0.01);
  const shown = imperial ? `${Math.round(day.waterMl / 29.57)} / ${Math.round(goal / 29.57)} fl oz` : `${(day.waterMl / 1000).toFixed(2)} / ${(goal / 1000).toFixed(1)} L`;
  return (
    <section className="card" style={pageStyle} aria-label="Water and exercise">
      <div className="row between">
        <span className="row" style={{ gap: 8, fontWeight: 600 }}>
          <Icon name="drop" size={18} /> Water
        </span>
        <span className="num small muted">{shown}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cups, 12)}, 1fr)`, gap: 5, margin: '14px 0' }}>
        {Array.from({ length: Math.min(cups, 12) }, (_, i) => (
          <span key={i} style={{ height: 30, borderRadius: '4px 4px 8px 8px', border: '1.5px solid var(--water)', background: i < filled ? 'var(--water)' : 'transparent', transition: 'background 200ms' }} />
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm ghost" onClick={() => logWater(nav.date, -cup)} disabled={day.waterMl <= 0} aria-label="Remove a cup">
          <Icon name="minus" size={18} />
        </button>
        <button className="btn sm" style={{ flex: 1 }} onClick={() => logWater(nav.date, cup)}>
          <Icon name="plus" size={18} /> {imperial ? '8 oz cup' : '250 ml'}
        </button>
        <button className="btn sm ghost" onClick={() => logWater(nav.date, imperial ? 473 : 500)}>
          {imperial ? '16 oz' : '500 ml'}
        </button>
      </div>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <div className="row between">
          <span className="row" style={{ gap: 8, fontWeight: 600 }}>
            <Icon name="run" size={18} /> Burned
          </span>
          <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>{fmt(day.burned)} <span className="small muted" style={{ fontFamily: 'var(--sans)' }}>cal</span></span>
        </div>
        <button className="btn sm ghost block" style={{ marginTop: 10 }} onClick={() => nav.push({ kind: 'exercise' })}>
          Log exercise
        </button>
      </div>
    </section>
  );
}

function DayList({ day }: { day: DayData }) {
  const nav = useNav();
  type Item = { t: number; food?: FoodEntry; ex?: ExerciseEntry };
  const items: Item[] = [...day.entries.map(f => ({ t: f.createdAt, food: f })), ...day.exercises.map(e => ({ t: e.createdAt, ex: e }))].sort((a, b) => b.t - a.t);
  if (!items.length)
    return (
      <div className="card" style={{ textAlign: 'center', padding: '30px 20px', boxShadow: 'none', background: 'transparent', border: '1.5px dashed var(--line)' }}>
        <div className="serif" style={{ fontSize: 20, fontWeight: 600 }}>Nothing logged yet</div>
        <p className="muted small" style={{ margin: '6px 0 16px' }}>Snap your first meal and the numbers fill in by themselves.</p>
        <button className="btn sm accent" onClick={() => nav.push({ kind: 'camera', mode: 'food' })}>
          <Icon name="camera" size={18} /> Scan a meal
        </button>
      </div>
    );
  return (
    <div className="stack" style={{ gap: 10 }}>
      {items.map(it => (it.food ? <FoodRow key={'f' + it.food.id} e={it.food} /> : <ExerciseRow key={'e' + it.ex!.id} e={it.ex!} />))}
    </div>
  );
}

const time = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function FoodRow({ e }: { e: FoodEntry }) {
  const nav = useNav();
  const thumb = usePhoto(e.photoId);
  const t = entryTotals(e);
  return (
    <div className="card row rise" style={{ padding: 10, gap: 12, alignItems: 'stretch' }}>
      <button style={{ display: 'contents' }} onClick={() => e.status !== 'analyzing' && nav.push({ kind: 'food', id: e.id! })} aria-label={`Open ${e.name}`}>
        <div style={{ position: 'relative' }}>
          <Thumb src={thumb} size={70} />
          {e.status === 'analyzing' && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'rgba(20,14,10,.45)', display: 'grid', placeItems: 'center', color: '#fff' }}>
              <span className="spinner" />
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'grid', alignContent: 'center', gap: 4 }}>
          <div className="row between" style={{ gap: 8 }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.status === 'analyzing' ? (e.source === 'label' ? 'Reading the label…' : 'Working out what this is…') : e.name}
            </span>
            <span className="small faint" style={{ flex: 'none' }}>{time(e.createdAt)}</span>
          </div>
          {e.status === 'analyzing' && (
            <>
              <div className="skeleton" style={{ height: 12, width: '45%' }} />
              <div className="skeleton" style={{ height: 10, width: '70%' }} />
            </>
          )}
          {e.status === 'ready' && (
            <>
              <span className="num" style={{ fontWeight: 600 }}>
                {fmt(t.kcal)} <span className="small muted" style={{ fontFamily: 'var(--sans)', fontWeight: 400 }}>cal</span>
              </span>
              <span className="small muted row" style={{ gap: 10 }}>
                <Macro c="var(--protein)" v={t.protein} l="P" />
                <Macro c="var(--carbs)" v={t.carbs} l="C" />
                <Macro c="var(--fat)" v={t.fat} l="F" />
              </span>
            </>
          )}
          {e.status === 'error' && <span className="small" style={{ color: 'var(--bad)' }}>{e.error || 'Something went wrong.'}</span>}
        </div>
      </button>
      {e.status === 'error' && (
        <button className="btn sm ghost" style={{ alignSelf: 'center' }} onClick={() => runAnalysis(e.id!)}>
          <Icon name="refresh" size={16} /> Retry
        </button>
      )}
    </div>
  );
}

function Macro({ c, v, l }: { c: string; v: number; l: string }) {
  return (
    <span className="row" style={{ gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: 2, background: c }} />
      <span className="num">{Math.round(v)}g</span>
      <span className="faint">{l}</span>
    </span>
  );
}

function ExerciseRow({ e }: { e: ExerciseEntry }) {
  const nav = useNav();
  const icon = e.kind === 'lift' ? 'lift' : e.kind === 'run' ? 'run' : 'spark';
  const remove = async () => {
    await db.exercises.delete(e.id!);
    nav.showToast('Exercise removed', { label: 'Undo', run: () => void db.exercises.put(e) });
  };
  return (
    <div className="card row rise" style={{ padding: 10, gap: 12 }}>
      <div style={{ width: 70, height: 56, borderRadius: 14, background: 'var(--card-2)', display: 'grid', placeItems: 'center' }}>
        <Icon name={icon} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row between">
          <span style={{ fontWeight: 600 }}>{e.label}</span>
          <span className="small faint">{time(e.createdAt)}</span>
        </div>
        <span className="small muted">
          <span className="num" style={{ color: 'var(--good)', fontWeight: 600 }}>{fmt(e.kcal)} cal burned</span>
          {e.minutes ? ` · ${e.minutes} min` : ''}
        </span>
      </div>
      <button className="icon-btn flat" aria-label="Remove exercise" onClick={remove}>
        <Icon name="trash" size={18} />
      </button>
    </div>
  );
}
