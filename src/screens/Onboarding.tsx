import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_AI, db, type Settings } from '../lib/db';
import { computePlan, goalDate } from '../lib/plan';
import type { Activity, Diet, Goal, Profile, Sex } from '../lib/types';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg, todayIso } from '../lib/units';
import { Icon } from '../ui/Icon';
import { Ruler } from '../ui/primitives';

type Step = 'welcome' | 'sex' | 'activity' | 'body' | 'birthday' | 'goal' | 'target' | 'pace' | 'obstacles' | 'diet' | 'aims' | 'burned' | 'rollover' | 'building' | 'plan';

const PACE = { lose: [0.2, 3.0, 1.0], gain: [0.2, 2.0, 0.5] } as const;

export function Onboarding({ existing }: { existing?: Settings }) {
  const [p, setP] = useState<Profile>(
    existing?.profile ?? {
      sex: 'male',
      birthday: '2005-06-15',
      heightCm: 178,
      weightKg: 75,
      goalWeightKg: 72,
      goal: 'lose',
      activity: 'mid',
      paceLbPerWeek: 1,
      diet: 'classic',
      units: 'imperial',
      addBurned: false,
      rollover: false,
    },
  );
  const [step, setStep] = useState<Step>('welcome');
  const [picked, setPicked] = useState<Record<string, string[]>>({ obstacles: [], aims: [] });
  const set = (patch: Partial<Profile>) => setP(x => ({ ...x, ...patch }));

  const order: Step[] = useMemo(() => {
    const all: Step[] = ['welcome', 'sex', 'activity', 'body', 'birthday', 'goal', 'target', 'pace', 'obstacles', 'diet', 'aims', 'burned', 'rollover', 'building', 'plan'];
    return p.goal === 'maintain' ? all.filter(s => s !== 'target' && s !== 'pace') : all;
  }, [p.goal]);
  const idx = order.indexOf(step);
  const next = () => setStep(order[Math.min(order.length - 1, idx + 1)]);
  const back = () => setStep(order[Math.max(0, idx - 1)]);
  const progress = idx / (order.length - 2);

  async function finish() {
    const row: Settings = {
      id: 'me',
      onboarded: true,
      profile: p,
      customTargets: null,
      ai: existing?.ai ?? DEFAULT_AI,
      usdaKey: existing?.usdaKey ?? '',
      theme: existing?.theme ?? 'system',
      seenCameraTips: existing?.seenCameraTips ?? false,
      celebrateBadges: existing?.celebrateBadges ?? true,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await db.settings.put(row);
    if (!existing) await db.weights.add({ date: todayIso(), createdAt: Date.now(), kg: p.weightKg });
  }

  if (step === 'welcome') return <Welcome onStart={next} />;
  if (step === 'building') return <Building onDone={next} />;
  if (step === 'plan') return <PlanReady p={p} onStart={finish} onBack={back} />;

  const canContinue = step !== 'target' || Math.abs(p.goalWeightKg - p.weightKg) > 0.2 && (p.goal === 'lose' ? p.goalWeightKg < p.weightKg : p.goalWeightKg > p.weightKg);

  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
      <div className="row" style={{ gap: 14, marginBottom: 26 }}>
        <button className="icon-btn" onClick={back} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="meter" style={{ flex: 1, height: 5 }}>
          <span style={{ transform: `scaleX(${progress})`, background: 'var(--accent)' }} />
        </div>
      </div>

      <div key={step} className="rise" style={{ flex: 1 }}>
        {step === 'sex' && (
          <Q title="What's your sex?" sub="Used to estimate your metabolism.">
            {(['female', 'male', 'other'] as Sex[]).map(s => (
              <Opt key={s} on={p.sex === s} onClick={() => set({ sex: s })} label={s[0].toUpperCase() + s.slice(1)} />
            ))}
          </Q>
        )}

        {step === 'activity' && (
          <Q title="How many workouts a week?" sub="Sets your baseline activity level.">
            {([
              ['low', '0–2', 'Now and then'],
              ['mid', '3–5', 'A few a week'],
              ['high', '6+', 'Training most days'],
            ] as [Activity, string, string][]).map(([a, g, s]) => (
              <Opt key={a} on={p.activity === a} onClick={() => set({ activity: a })} glyph={g} label={s} />
            ))}
          </Q>
        )}

        {step === 'body' && <BodyStep p={p} set={set} />}

        {step === 'birthday' && (
          <Q title="When were you born?" sub="Metabolism slows a little every decade.">
            <input
              className="input num"
              type="date"
              value={p.birthday}
              max={todayIso()}
              onChange={e => e.target.value && set({ birthday: e.target.value })}
              style={{ fontSize: 22, minHeight: 64, textAlign: 'center' }}
            />
          </Q>
        )}

        {step === 'goal' && (
          <Q title="What's the goal?" sub="You can change this any time.">
            {([
              ['lose', 'Lose weight', '−'],
              ['maintain', 'Maintain', '='],
              ['gain', 'Gain weight', '+'],
            ] as [Goal, string, string][]).map(([g, l, glyph]) => (
              <Opt
                key={g}
                on={p.goal === g}
                glyph={glyph}
                label={l}
                onClick={() =>
                  set({
                    goal: g,
                    goalWeightKg: g === 'lose' ? p.weightKg - lbToKg(10) : g === 'gain' ? p.weightKg + lbToKg(8) : p.weightKg,
                    paceLbPerWeek: g === 'gain' ? 0.5 : 1,
                  })
                }
              />
            ))}
          </Q>
        )}

        {step === 'target' && (
          <Q title="What's your target weight?" sub={p.goal === 'lose' ? 'Pick something below where you are now.' : 'Pick something above where you are now.'}>
            <div className="card" style={{ padding: '22px 0 18px' }}>
              {p.units === 'imperial' ? (
                <Ruler value={+kgToLb(p.goalWeightKg).toFixed(1)} onChange={v => set({ goalWeightKg: lbToKg(v) })} min={80} max={450} step={0.5} unit="lb" />
              ) : (
                <Ruler value={+p.goalWeightKg.toFixed(1)} onChange={v => set({ goalWeightKg: v })} min={35} max={200} step={0.5} unit="kg" />
              )}
            </div>
            <p className="muted small" style={{ textAlign: 'center' }}>
              {p.goal === 'lose' ? 'Lose' : 'Gain'}{' '}
              <b className="num">
                {p.units === 'imperial' ? `${kgToLb(Math.abs(p.weightKg - p.goalWeightKg)).toFixed(1)} lb` : `${Math.abs(p.weightKg - p.goalWeightKg).toFixed(1)} kg`}
              </b>
            </p>
          </Q>
        )}

        {step === 'pace' && <PaceStep p={p} set={set} />}

        {step === 'obstacles' && (
          <Multi
            title="What usually gets in the way?"
            sub="Pick any. Morsel is built around these."
            options={['Losing consistency', 'Eating out a lot', 'Busy schedule', 'Not sure what to eat', 'Snacking at night', 'Tracking takes too long']}
            value={picked.obstacles}
            onChange={v => setPicked(x => ({ ...x, obstacles: v }))}
          />
        )}

        {step === 'diet' && (
          <Q title="Do you follow a diet?" sub="Helps the scanner guess what's on your plate.">
            {([
              ['classic', 'No restrictions'],
              ['pescatarian', 'Pescatarian'],
              ['vegetarian', 'Vegetarian'],
              ['vegan', 'Vegan'],
            ] as [Diet, string][]).map(([d, l]) => (
              <Opt key={d} on={p.diet === d} onClick={() => set({ diet: d })} label={l} />
            ))}
          </Q>
        )}

        {step === 'aims' && (
          <Multi
            title="What else do you want out of this?"
            options={['Eat healthier overall', 'More energy', 'Build muscle', 'Feel better in my body', 'Understand what I eat']}
            value={picked.aims}
            onChange={v => setPicked(x => ({ ...x, aims: v }))}
          />
        )}

        {step === 'burned' && (
          <YesNo
            title="Add calories you burn back to your day?"
            sub="Log a 300-calorie run and today's budget grows by 300."
            value={p.addBurned}
            onChange={v => set({ addBurned: v })}
            demo={['2,100', '+300 run', '2,400']}
          />
        )}

        {step === 'rollover' && (
          <YesNo
            title="Roll unused calories into tomorrow?"
            sub="Up to 200 calories you didn't eat today carry over to tomorrow's budget."
            value={p.rollover}
            onChange={v => set({ rollover: v })}
            demo={['2,100', '+150 from yesterday', '2,250']}
          />
        )}
      </div>

      <button className="btn block" style={{ marginTop: 20 }} disabled={!canContinue} onClick={next}>
        Continue
      </button>
    </div>
  );
}

function Q({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="serif" style={{ fontSize: 32, lineHeight: 1.08, margin: '0 0 8px', fontWeight: 600 }}>
        {title}
      </h1>
      {sub && <p className="muted" style={{ margin: '0 0 26px' }}>{sub}</p>}
      <div className="stack">{children}</div>
    </div>
  );
}

function Opt({ on, onClick, label, glyph, sub }: { on: boolean; onClick: () => void; label: string; glyph?: string; sub?: string }) {
  return (
    <button className="option" aria-pressed={on} onClick={onClick}>
      {glyph && <span className="glyph">{glyph}</span>}
      <span>
        {label}
        {sub && <span className="sub">{sub}</span>}
      </span>
    </button>
  );
}

function Multi({ title, sub, options, value, onChange }: { title: string; sub?: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Q title={title} sub={sub}>
      {options.map(o => (
        <Opt key={o} on={value.includes(o)} label={o} onClick={() => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o])} />
      ))}
    </Q>
  );
}

function YesNo({ title, sub, value, onChange, demo }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void; demo: [string, string, string] }) {
  return (
    <Q title={title} sub={sub}>
      <div className="card row between" style={{ padding: '18px 20px', marginBottom: 8 }}>
        <div>
          <div className="tiny faint">Budget</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{demo[0]}</div>
        </div>
        <div className="chip" style={{ background: 'var(--accent-soft)', borderColor: 'transparent', color: 'var(--accent)' }}>{demo[1]}</div>
        <div style={{ textAlign: 'right' }}>
          <div className="tiny faint">New</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{demo[2]}</div>
        </div>
      </div>
      <Opt on={value} onClick={() => onChange(true)} label="Yes" />
      <Opt on={!value} onClick={() => onChange(false)} label="No" />
    </Q>
  );
}

function BodyStep({ p, set }: { p: Profile; set: (x: Partial<Profile>) => void }) {
  const { ft, inch } = cmToFtIn(p.heightCm);
  return (
    <Q title="Height and weight" sub="Your starting point.">
      <div className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 6 }}>
        {(['imperial', 'metric'] as const).map(u => (
          <button key={u} className="chip" aria-pressed={p.units === u} onClick={() => set({ units: u })}>
            {u === 'imperial' ? 'Imperial' : 'Metric'}
          </button>
        ))}
      </div>
      <div className="card stack">
        <div className="tiny faint">Height</div>
        {p.units === 'imperial' ? (
          <div className="row">
            <select className="input num" value={ft} onChange={e => set({ heightCm: ftInToCm(+e.target.value, inch) })} aria-label="Feet">
              {[3, 4, 5, 6, 7, 8].map(v => <option key={v} value={v}>{v} ft</option>)}
            </select>
            <select className="input num" value={inch} onChange={e => set({ heightCm: ftInToCm(ft, +e.target.value) })} aria-label="Inches">
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i} in</option>)}
            </select>
          </div>
        ) : (
          <select className="input num" value={Math.round(p.heightCm)} onChange={e => set({ heightCm: +e.target.value })} aria-label="Centimetres">
            {Array.from({ length: 131 }, (_, i) => 100 + i).map(v => <option key={v} value={v}>{v} cm</option>)}
          </select>
        )}
      </div>
      <div className="card" style={{ padding: '18px 0 16px' }}>
        <div className="tiny faint" style={{ padding: '0 16px 10px' }}>Weight</div>
        {p.units === 'imperial' ? (
          <Ruler key="lb" value={+kgToLb(p.weightKg).toFixed(1)} onChange={v => set({ weightKg: lbToKg(v), goalWeightKg: p.goalWeightKg + (lbToKg(v) - p.weightKg) })} min={80} max={450} step={0.5} unit="lb" />
        ) : (
          <Ruler key="kg" value={+p.weightKg.toFixed(1)} onChange={v => set({ weightKg: v, goalWeightKg: p.goalWeightKg + (v - p.weightKg) })} min={35} max={200} step={0.5} unit="kg" />
        )}
      </div>
    </Q>
  );
}

function PaceStep({ p, set }: { p: Profile; set: (x: Partial<Profile>) => void }) {
  const [lo, hi, rec] = p.goal === 'gain' ? PACE.gain : PACE.lose;
  const label = p.paceLbPerWeek <= rec * 0.6 ? 'Gentle' : p.paceLbPerWeek <= rec * 1.25 ? 'Balanced' : p.paceLbPerWeek <= rec * 2 ? 'Ambitious' : 'Aggressive';
  const shown = p.units === 'imperial' ? `${p.paceLbPerWeek.toFixed(1)} lb` : `${lbToKg(p.paceLbPerWeek).toFixed(2)} kg`;
  const date = goalDate(p);
  return (
    <Q title={`How fast do you want to ${p.goal === 'gain' ? 'gain' : 'lose'}?`} sub="Per week. Slower is easier to stick with.">
      <div className="card" style={{ textAlign: 'center', padding: '26px 18px' }}>
        <div className="num" style={{ fontSize: 48, fontWeight: 600, lineHeight: 1 }}>{shown}</div>
        <div className="chip" style={{ marginTop: 12, background: label === 'Aggressive' ? 'var(--accent-soft)' : 'var(--card-2)', borderColor: 'transparent' }}>{label}</div>
        <input
          type="range"
          min={lo}
          max={hi}
          step={0.1}
          value={p.paceLbPerWeek}
          onChange={e => set({ paceLbPerWeek: +e.target.value })}
          style={{ width: '100%', marginTop: 26, accentColor: 'var(--accent)' }}
          aria-label="Pace per week"
        />
        <div className="row between small faint">
          <span>Gentle</span>
          <span>Balanced</span>
          <span>Fast</span>
        </div>
      </div>
      <button className="chip" style={{ justifySelf: 'center' }} onClick={() => set({ paceLbPerWeek: rec })}>
        Use the recommended {p.units === 'imperial' ? `${rec} lb` : `${lbToKg(rec).toFixed(1)} kg`}
      </button>
      {date && (
        <p className="muted small" style={{ textAlign: 'center' }}>
          You'd reach your target around <b>{date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</b>.
        </p>
      )}
    </Q>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingTop: 'calc(var(--safe-top) + 24px)', paddingBottom: 'calc(var(--safe-bottom) + 18px)' }}>
      <div className="row" style={{ gap: 10 }}>
        <Logo />
        <span className="serif" style={{ fontSize: 22, fontWeight: 600 }}>Morsel</span>
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <WelcomeArt />
      </div>
      <h1 className="serif rise" style={{ fontSize: 42, lineHeight: 1.02, margin: '0 0 12px', fontWeight: 600 }}>
        Snap a meal.
        <br />
        <span style={{ color: 'var(--accent)' }}>Know what's in it.</span>
      </h1>
      <p className="muted rise" style={{ margin: '0 0 26px', animationDelay: '80ms' }}>
        Calories and macros from a photo, a barcode, a label or a sentence. Everything stays on your phone.
      </p>
      <button className="btn block accent" onClick={onStart}>
        Build my plan
      </button>
    </div>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M8 22V11.5l4.5 6 3.5-6 3.5 6 4.5-6V22" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WelcomeArt() {
  // a plate with a scan frame and three macro bars
  return (
    <svg viewBox="0 0 280 240" width="100%" style={{ maxWidth: 320 }} aria-hidden="true">
      <circle cx="140" cy="120" r="92" fill="var(--card)" />
      <circle cx="140" cy="120" r="66" fill="none" stroke="var(--line)" strokeWidth="2" />
      <circle cx="118" cy="108" r="22" fill="var(--carbs)" opacity=".85" />
      <path d="M140 86c22 0 38 14 38 30h-40z" fill="var(--fat)" opacity=".85" />
      <rect x="126" y="126" width="46" height="28" rx="12" fill="var(--protein)" opacity=".85" />
      {[
        [36, 20],
        [244, 20],
        [36, 220],
        [244, 220],
      ].map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y + (y < 100 ? 26 : -26)}V${y}H${x + (x < 100 ? 26 : -26)}`}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function Building({ onDone }: { onDone: () => void }) {
  const steps = ['Estimating your resting metabolism', 'Adding your activity', 'Setting a calorie budget', 'Splitting protein, carbs and fat', 'Projecting your timeline'];
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= steps.length) {
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN(n + 1), 520);
    return () => clearTimeout(t);
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'grid', alignContent: 'center', gap: 22 }}>
      <div className="num" style={{ fontSize: 72, fontWeight: 600, lineHeight: 1 }}>{Math.round((n / steps.length) * 100)}%</div>
      <h1 className="serif" style={{ fontSize: 28, margin: 0, fontWeight: 600 }}>Building your plan</h1>
      <div className="meter" style={{ height: 6 }}>
        <span style={{ transform: `scaleX(${n / steps.length})`, background: 'var(--accent)' }} />
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {steps.map((s, i) => (
          <div key={s} className="row" style={{ opacity: i < n ? 1 : i === n ? 0.6 : 0.25, transition: 'opacity 300ms' }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', background: i < n ? 'var(--ink)' : 'var(--card-2)', color: 'var(--paper)' }}>
              {i < n && <Icon name="check" size={14} stroke={2.6} />}
            </span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanReady({ p, onStart, onBack }: { p: Profile; onStart: () => void; onBack: () => void }) {
  const t = computePlan(p);
  const date = goalDate(p);
  const diff = Math.abs(p.weightKg - p.goalWeightKg);
  const diffText = p.units === 'imperial' ? `${kgToLb(diff).toFixed(0)} lb` : `${diff.toFixed(1)} kg`;
  const tiles = [
    { k: 'Protein', v: t.protein, c: 'var(--protein)' },
    { k: 'Carbs', v: t.carbs, c: 'var(--carbs)' },
    { k: 'Fat', v: t.fat, c: 'var(--fat)' },
  ];
  return (
    <div className="page rise" style={{ paddingTop: 'calc(var(--safe-top) + 10px)', paddingBottom: 'calc(var(--safe-bottom) + 18px)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <button className="icon-btn" onClick={onBack} aria-label="Back">
        <Icon name="back" />
      </button>
      <h1 className="serif" style={{ fontSize: 34, lineHeight: 1.05, margin: '22px 0 8px', fontWeight: 600 }}>Your plan is ready.</h1>
      {date ? (
        <p className="muted" style={{ margin: 0 }}>
          {p.goal === 'lose' ? 'Lose' : 'Gain'} {diffText} by <b style={{ color: 'var(--ink)' }}>{date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</b>.
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>Hold steady at your current weight.</p>
      )}

      <div className="card" style={{ marginTop: 26, padding: 20 }}>
        <div className="tiny faint">Daily budget</div>
        <div className="num" style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.05 }}>
          {t.kcal.toLocaleString()}
          <span className="muted" style={{ fontSize: 18, fontFamily: 'var(--sans)', marginLeft: 6 }}>cal</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 18 }}>
          {tiles.map(x => (
            <div key={x.k} style={{ background: 'var(--card-2)', borderRadius: 14, padding: '12px 12px 10px' }}>
              <div className="small muted">{x.k}</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 600 }}>{x.v}g</div>
              <div style={{ height: 4, borderRadius: 4, background: x.c, marginTop: 6 }} />
            </div>
          ))}
        </div>
        <div className="row between small muted" style={{ marginTop: 16 }}>
          <span>Fiber {t.fiber}g</span>
          <span>Sugar under {t.sugar}g</span>
          <span>Sodium {t.sodium.toLocaleString()}mg</span>
        </div>
      </div>

      <div className="stack small muted" style={{ marginTop: 22, gap: 8 }}>
        <div>• Log every meal, even the messy ones. A rough log beats no log.</div>
        <div>• Aim to hit protein; the rest tends to follow.</div>
        <div>• Weigh in a few times a week, same time of day.</div>
      </div>

      <div style={{ flex: 1 }} />
      <p className="faint small" style={{ textAlign: 'center' }}>Estimated with the Mifflin-St Jeor equation. Not medical advice. You can fine-tune every number later.</p>
      <button className="btn block accent" onClick={onStart}>
        Start tracking
      </button>
    </div>
  );
}
