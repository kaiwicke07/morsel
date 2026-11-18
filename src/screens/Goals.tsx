import { useState } from 'react';
import { baseTargets, useSettings } from '../data';
import { patchSettings, type Settings } from '../lib/db';
import { computePlan } from '../lib/plan';
import type { Targets } from '../lib/types';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/primitives';

export function Goals() {
  const nav = useNav();
  const s = useSettings();
  if (!s) return null;
  return <Inner s={s} onClose={nav.pop} toast={nav.showToast} />;
}

const ROWS: [keyof Targets, string, string, string][] = [
  ['kcal', 'Calories', 'cal', 'var(--accent)'],
  ['protein', 'Protein', 'g', 'var(--protein)'],
  ['carbs', 'Carbs', 'g', 'var(--carbs)'],
  ['fat', 'Fat', 'g', 'var(--fat)'],
  ['fiber', 'Fiber (at least)', 'g', 'var(--ink-2)'],
  ['sugar', 'Sugar (at most)', 'g', 'var(--ink-2)'],
  ['sodium', 'Sodium (at most)', 'mg', 'var(--ink-2)'],
  ['water', 'Water', 'ml', 'var(--water)'],
];

function Inner({ s, onClose, toast }: { s: Settings; onClose: () => void; toast: (t: string) => void }) {
  const [t, setT] = useState<Record<keyof Targets, string>>(() => {
    const b = baseTargets(s);
    return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v)])) as Record<keyof Targets, string>;
  });
  const n = (k: keyof Targets) => Math.max(0, Math.round(Number(t[k]) || 0));
  const macroKcal = n('protein') * 4 + n('carbs') * 4 + n('fat') * 9;
  const off = Math.abs(macroKcal - n('kcal')) > n('kcal') * 0.05;

  return (
    <Screen title="Nutrition goals" onClose={onClose}>
      {close => (
        <div className="page stack" style={{ paddingBottom: 30 }}>
          <div className="card row" style={{ background: s.customTargets ? 'var(--card)' : 'var(--accent-soft)', boxShadow: 'none' }}>
            <span className="small" style={{ flex: 1 }}>
              {s.customTargets ? 'You set these by hand. They won’t change when your weight does.' : 'These come from your profile and update when you log a new weight.'}
            </span>
          </div>
          <div className="card stack" style={{ gap: 12 }}>
            {ROWS.map(([k, label, unit, c]) => (
              <div key={k} className="row between">
                <label htmlFor={`g-${k}`} className="row" style={{ gap: 8, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: c }} />
                  {label}
                </label>
                <div className="row" style={{ gap: 6 }}>
                  <input id={`g-${k}`} className="input num" inputMode="numeric" style={{ width: 100, textAlign: 'right' }} value={t[k]} onChange={e => setT(x => ({ ...x, [k]: e.target.value.replace(/\D/g, '') }))} />
                  <span className="small muted" style={{ width: 26 }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
          {off && (
            <p className="small" style={{ margin: 0, color: 'var(--bad)' }}>
              Your macros add up to {macroKcal.toLocaleString()} cal, not {n('kcal').toLocaleString()}.{' '}
              <button
                style={{ fontWeight: 700, textDecoration: 'underline' }}
                onClick={() => {
                  const k = n('kcal') / Math.max(1, macroKcal);
                  setT(x => ({ ...x, protein: String(Math.round(n('protein') * k)), carbs: String(Math.round(n('carbs') * k)), fat: String(Math.round(n('fat') * k)) }));
                }}
              >
                Scale them to fit
              </button>
            </p>
          )}
          <button
            className="btn block"
            disabled={n('kcal') < 800}
            onClick={async () => {
              const custom = Object.fromEntries(ROWS.map(([k]) => [k, n(k)])) as unknown as Targets;
              await patchSettings({ customTargets: custom });
              close();
              toast('Goals saved');
            }}
          >
            Save
          </button>
          <button
            className="btn ghost block"
            onClick={async () => {
              await patchSettings({ customTargets: null });
              const p = computePlan(s.profile);
              setT(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) as Record<keyof Targets, string>);
              toast('Back to automatic goals');
            }}
          >
            <Icon name="refresh" size={18} /> Auto-generate from my profile
          </button>
        </div>
      )}
    </Screen>
  );
}
