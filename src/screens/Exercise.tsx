import { useState } from 'react';
import { useCurrentWeight, useSettings } from '../data';
import { describeExercise } from '../lib/ai';
import { db } from '../lib/db';
import { INTENSITY_COPY, exerciseKcal } from '../lib/exercise';
import type { ExerciseEntry } from '../lib/types';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/primitives';

type Kind = ExerciseEntry['kind'];

export function Exercise() {
  const nav = useNav();
  const s = useSettings();
  const kg = useCurrentWeight(s) ?? 70;
  const [kind, setKind] = useState<Kind | null>(null);
  const [intensity, setIntensity] = useState<1 | 2 | 3>(2);
  const [minutes, setMinutes] = useState(30);
  const [text, setText] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [result, setResult] = useState<{ label: string; minutes?: number; kcal: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async (close: () => void, r: { label: string; minutes?: number; kcal: number }) => {
    await db.exercises.add({ date: nav.date, createdAt: Date.now(), kind: kind!, label: r.label, minutes: r.minutes, intensity: kind === 'run' || kind === 'lift' ? intensity : undefined, kcal: Math.round(r.kcal) });
    close();
    nav.showToast(`Logged ${Math.round(r.kcal)} cal burned`);
  };

  return (
    <Screen title={result ? 'Confirm' : 'Exercise'} onClose={nav.pop}>
      {close => (
        <div className="page stack" style={{ paddingBottom: 30 }}>
          {!kind && (
            <>
              <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: '8px 0 6px' }}>What did you do?</h1>
              {([
                ['run', 'run', 'Run or walk', 'Treadmill, outdoors, hiking'],
                ['lift', 'lift', 'Weights', 'Machines, free weights, bodyweight'],
                ['describe', 'spark', 'Describe it', 'Yoga, tennis, a long bike ride… AI works it out'],
                ['manual', 'pencil', 'Enter calories', 'From your watch or a machine'],
              ] as [Kind, string, string, string][]).map(([k, icon, label, sub]) => (
                <button key={k} className="option" onClick={() => setKind(k)}>
                  <span className="glyph"><Icon name={icon} /></span>
                  <span>
                    {label}
                    <span className="sub">{sub}</span>
                  </span>
                </button>
              ))}
            </>
          )}

          {(kind === 'run' || kind === 'lift') && !result && (
            <>
              <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: '8px 0 0' }}>{kind === 'run' ? 'Run or walk' : 'Weights'}</h1>
              <div className="tiny faint" style={{ marginTop: 10 }}>Intensity</div>
              {([3, 2, 1] as const).map(i => (
                <button key={i} className="option" aria-pressed={intensity === i} onClick={() => setIntensity(i)}>
                  <span className="glyph" style={{ fontSize: 13, letterSpacing: 1 }}>{'▮'.repeat(i)}{'▯'.repeat(3 - i)}</span>
                  <span>
                    {INTENSITY_COPY[kind][i].title}
                    <span className="sub">{INTENSITY_COPY[kind][i].hint}</span>
                  </span>
                </button>
              ))}
              <div className="tiny faint" style={{ marginTop: 10 }}>Duration</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {[15, 30, 45, 60, 90].map(m => (
                  <button key={m} className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>
                ))}
                <input className="input num" inputMode="numeric" aria-label="Custom minutes" style={{ width: 90, minHeight: 38 }} value={String(minutes)} onChange={e => setMinutes(Math.min(600, Number(e.target.value.replace(/\D/g, '')) || 0))} />
              </div>
              <div className="card row between" style={{ marginTop: 8 }}>
                <span className="muted">Estimated burn</span>
                <span className="num" style={{ fontSize: 26, fontWeight: 600 }}>{exerciseKcal(kind, intensity, minutes, kg)} cal</span>
              </div>
              <button className="btn block accent" disabled={minutes <= 0} onClick={() => save(close, { label: `${INTENSITY_COPY[kind][intensity].title} ${kind === 'run' ? 'run' : 'lifting'}`, minutes, kcal: exerciseKcal(kind, intensity, minutes, kg) })}>
                Log it
              </button>
            </>
          )}

          {kind === 'describe' && !result && (
            <form
              className="stack"
              onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setErr(null);
                try {
                  setResult(await describeExercise(text.trim(), kg));
                } catch (x) {
                  setErr(x instanceof Error ? x.message : 'Failed');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: '8px 0 0' }}>Describe your workout</h1>
              <textarea className="input" autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="e.g. 45 minutes of hot yoga, or 18 holes of golf walking" />
              {err && <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>{err}</p>}
              <button className="btn block accent" disabled={!text.trim() || busy}>
                {busy ? <span className="spinner" /> : <Icon name="spark" size={20} />} Estimate
              </button>
            </form>
          )}

          {kind === 'manual' && (
            <form className="stack" onSubmit={e => { e.preventDefault(); void save(close, { label: 'Workout', kcal: Number(manualKcal) }); }}>
              <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: '8px 0 0' }}>Calories burned</h1>
              <input className="input num" autoFocus inputMode="numeric" style={{ fontSize: 32, minHeight: 72, textAlign: 'center' }} value={manualKcal} onChange={e => setManualKcal(e.target.value.replace(/\D/g, ''))} placeholder="0" />
              <button className="btn block accent" disabled={!(Number(manualKcal) > 0)}>Log it</button>
            </form>
          )}

          {result && (
            <div className="stack">
              <div className="card" style={{ textAlign: 'center', padding: 26 }}>
                <div className="muted">{result.label}{result.minutes ? ` · ${result.minutes} min` : ''}</div>
                <div className="num" style={{ fontSize: 60, fontWeight: 600, lineHeight: 1.1 }}>{result.kcal}</div>
                <div className="muted">calories burned</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn ghost" style={{ flex: 1 }} onClick={() => setResult({ ...result, kcal: Math.max(0, result.kcal - 25) })}>−25</button>
                <button className="btn ghost" style={{ flex: 1 }} onClick={() => setResult({ ...result, kcal: result.kcal + 25 })}>+25</button>
              </div>
              <button className="btn block accent" onClick={() => save(close, result)}>Log it</button>
            </div>
          )}

          {kind && !result && (
            <button className="btn ghost block" onClick={() => setKind(null)}>
              Back
            </button>
          )}
        </div>
      )}
    </Screen>
  );
}
