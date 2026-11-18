import { useState } from 'react';
import { logWeight, useCurrentWeight, useSettings } from '../data';
import { kgToLb, lbToKg, todayIso } from '../lib/units';
import { useNav } from '../nav';
import { Ruler, Screen } from '../ui/primitives';

export function WeightLog() {
  const nav = useNav();
  const s = useSettings();
  const current = useCurrentWeight(s);
  if (!s || current === undefined) return null;
  return <Inner imperial={s.profile.units === 'imperial'} current={current} onDone={nav.pop} toast={nav.showToast} />;
}

function Inner({ imperial, current, onDone, toast }: { imperial: boolean; current: number; onDone: () => void; toast: (t: string) => void }) {
  const [v, setV] = useState(+(imperial ? kgToLb(current) : current).toFixed(1));
  const base = Math.round(imperial ? kgToLb(current) : current);
  return (
    <Screen title="Log weight" onClose={onDone}>
      {close => (
        <div className="page stack" style={{ gap: 22 }}>
          <div className="card" style={{ padding: '26px 0 20px', marginTop: 10 }}>
            <Ruler value={v} onChange={setV} min={Math.max(20, base - 60)} max={base + 60} step={0.1} unit={imperial ? 'lb' : 'kg'} />
          </div>
          <p className="muted small" style={{ textAlign: 'center', margin: 0 }}>Drag the ruler. Same time each day, ideally after waking, gives the cleanest trend.</p>
          <button
            className="btn block accent"
            onClick={async () => {
              await logWeight(imperial ? lbToKg(v) : v, todayIso());
              close();
              toast('Weight saved. Your plan has been updated.');
            }}
          >
            Save
          </button>
        </div>
      )}
    </Screen>
  );
}
