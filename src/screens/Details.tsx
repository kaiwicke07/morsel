import { useState } from 'react';
import { useSettings } from '../data';
import { patchSettings, type Settings } from '../lib/db';
import { computePlan } from '../lib/plan';
import type { Activity, Diet, Goal, Profile, Sex } from '../lib/types';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg, todayIso } from '../lib/units';
import { useNav } from '../nav';
import { Screen } from '../ui/primitives';

export function Details() {
  const nav = useNav();
  const s = useSettings();
  if (!s) return null;
  return <Inner s={s} onClose={nav.pop} toast={nav.showToast} />;
}

function Sel<T extends string>({ id, label, value, onChange, options }: { id: string; label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="row between">
      <label htmlFor={id} style={{ fontWeight: 600 }}>{label}</label>
      <select id={id} className="input" style={{ width: 'auto', minWidth: 150 }} value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Inner({ s, onClose, toast }: { s: Settings; onClose: () => void; toast: (t: string) => void }) {
  const [p, setP] = useState<Profile>(s.profile);
  const set = (x: Partial<Profile>) => setP(v => ({ ...v, ...x }));
  const imperial = p.units === 'imperial';
  const { ft, inch } = cmToFtIn(p.heightCm);
  const [goalText, setGoalText] = useState((imperial ? kgToLb(p.goalWeightKg) : p.goalWeightKg).toFixed(1));
  const plan = computePlan(p);

  return (
    <Screen title="Personal details" onClose={onClose}>
      {close => (
        <div className="page stack" style={{ paddingBottom: 30 }}>
          <div className="card stack" style={{ gap: 12 }}>
            <Sel id="d-sex" label="Sex" value={p.sex} onChange={v => set({ sex: v })} options={[['female', 'Female'], ['male', 'Male'], ['other', 'Other']] as [Sex, string][]} />
            <div className="row between">
              <label htmlFor="d-bd" style={{ fontWeight: 600 }}>Birthday</label>
              <input id="d-bd" className="input" type="date" style={{ width: 'auto' }} max={todayIso()} value={p.birthday} onChange={e => e.target.value && set({ birthday: e.target.value })} />
            </div>
            <div className="row between">
              <span style={{ fontWeight: 600 }}>Height</span>
              {imperial ? (
                <div className="row" style={{ gap: 6 }}>
                  <select className="input" aria-label="Feet" style={{ width: 'auto' }} value={ft} onChange={e => set({ heightCm: ftInToCm(+e.target.value, inch) })}>
                    {[3, 4, 5, 6, 7, 8].map(v => <option key={v} value={v}>{v} ft</option>)}
                  </select>
                  <select className="input" aria-label="Inches" style={{ width: 'auto' }} value={inch} onChange={e => set({ heightCm: ftInToCm(ft, +e.target.value) })}>
                    {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i} in</option>)}
                  </select>
                </div>
              ) : (
                <select className="input" aria-label="Centimetres" style={{ width: 'auto' }} value={Math.round(p.heightCm)} onChange={e => set({ heightCm: +e.target.value })}>
                  {Array.from({ length: 131 }, (_, i) => 100 + i).map(v => <option key={v} value={v}>{v} cm</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="card stack" style={{ gap: 12 }}>
            <Sel id="d-goal" label="Goal" value={p.goal} onChange={v => set({ goal: v })} options={[['lose', 'Lose weight'], ['maintain', 'Maintain'], ['gain', 'Gain weight']] as [Goal, string][]} />
            {p.goal !== 'maintain' && (
              <>
                <div className="row between">
                  <label htmlFor="d-gw" style={{ fontWeight: 600 }}>Target weight</label>
                  <div className="row" style={{ gap: 6 }}>
                    <input
                      id="d-gw"
                      className="input num"
                      inputMode="decimal"
                      style={{ width: 100, textAlign: 'right' }}
                      value={goalText}
                      onChange={e => {
                        setGoalText(e.target.value);
                        const v = Number(e.target.value.replace(',', '.'));
                        if (v > 0) set({ goalWeightKg: imperial ? lbToKg(v) : v });
                      }}
                    />
                    <span className="muted small">{imperial ? 'lb' : 'kg'}</span>
                  </div>
                </div>
                <div>
                  <div className="row between">
                    <label htmlFor="d-pace" style={{ fontWeight: 600 }}>Pace</label>
                    <span className="num">{imperial ? `${p.paceLbPerWeek.toFixed(1)} lb` : `${lbToKg(p.paceLbPerWeek).toFixed(2)} kg`} / week</span>
                  </div>
                  <input id="d-pace" type="range" min={0.2} max={p.goal === 'gain' ? 2 : 3} step={0.1} value={p.paceLbPerWeek} onChange={e => set({ paceLbPerWeek: +e.target.value })} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                </div>
              </>
            )}
            <Sel id="d-act" label="Workouts / week" value={p.activity} onChange={v => set({ activity: v })} options={[['low', '0–2'], ['mid', '3–5'], ['high', '6+']] as [Activity, string][]} />
            <Sel id="d-diet" label="Diet" value={p.diet} onChange={v => set({ diet: v })} options={[['classic', 'No restrictions'], ['pescatarian', 'Pescatarian'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan']] as [Diet, string][]} />
          </div>

          <div className="card row between">
            <span className="muted">New daily budget</span>
            <span className="num" style={{ fontSize: 24, fontWeight: 600 }}>{plan.kcal.toLocaleString()} cal</span>
          </div>
          {s.customTargets && <p className="small muted" style={{ margin: 0 }}>You have custom goals set, so these changes won’t alter them. Use “Auto-generate” in Nutrition goals to switch back.</p>}

          <button
            className="btn block"
            onClick={async () => {
              await patchSettings({ profile: p });
              close();
              toast('Details saved');
            }}
          >
            Save
          </button>
        </div>
      )}
    </Screen>
  );
}
