import { useState } from 'react';
import { sedentaryTdee, useSettings } from '../data';
import { patchSettings, type Settings } from '../lib/db';
import { DEFAULT_RELAY, syncGarmin } from '../lib/garminSync';
import { todayIso } from '../lib/units';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { Screen, Toggle } from '../ui/primitives';

export function GarminSettings() {
  const nav = useNav();
  const s = useSettings();
  if (!s) return null;
  return <Inner s={s} onClose={nav.pop} toast={nav.showToast} />;
}

function Inner({ s, onClose, toast }: { s: Settings; onClose: () => void; toast: (t: string) => void }) {
  const g = s.garmin;
  const [code, setCode] = useState(g?.code ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setErr(null);
    // Garmin's measured burn replaces the activity guess, so burned calories must be added back.
    await patchSettings({ garmin: { enabled: true, code: code.trim(), relayUrl: g?.relayUrl || DEFAULT_RELAY, since: g?.since ?? todayIso() }, profile: { ...s.profile, addBurned: true } });
    try {
      await syncGarmin(true);
      toast('Garmin connected');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Garmin" onClose={onClose}>
      {() => (
        <div className="page stack" style={{ paddingBottom: 30 }}>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Pulls your daily calories burned, steps and workouts from Garmin Connect. Your Garmin key sits on your private relay, not in this app.
          </p>

          {g?.enabled && (
            <div className="card row between">
              <span>
                <b>{g.lastError ? 'Sync problem' : 'Connected'}</b>
                <span className="small muted" style={{ display: 'block' }}>
                  {g.lastError ?? (g.lastSync ? `Last synced ${new Date(g.lastSync).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet')}
                </span>
              </span>
              <Toggle label="Use Garmin" checked={g.enabled} onChange={v => patchSettings({ garmin: { ...g, enabled: v } })} />
            </div>
          )}

          <div className="field">
            <label htmlFor="g-code">Sync code</label>
            <input id="g-code" className="input num" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" style={{ letterSpacing: '0.12em', fontSize: 20 }} />
          </div>
          {err && <p className="small" style={{ margin: 0, color: 'var(--bad)' }}>{err}</p>}
          <button className="btn block accent" disabled={!code || busy} onClick={connect}>
            {busy ? <span className="spinner" /> : <Icon name="refresh" size={18} />} {g?.enabled ? 'Sync now' : 'Connect'}
          </button>

          <div className="card small muted stack" style={{ gap: 8 }}>
            <b style={{ color: 'var(--ink)' }}>How your budget works with Garmin</b>
            <span>
              Your plan starts from a no-exercise baseline of about {Math.round(sedentaryTdee(s)).toLocaleString()} cal a day. Whatever your watch says you burned above that is added to the day, so workouts and busy days earn more food.
            </span>
            <span>Early in the day the watch hasn't counted much yet, so your budget never drops below the baseline.</span>
            <span>Numbers arrive when your watch syncs to the Garmin Connect app. Open it on your phone if today looks empty.</span>
          </div>

          {g?.enabled && (
            <button className="btn ghost block" onClick={async () => { await patchSettings({ garmin: { ...g, enabled: false } }); toast('Garmin turned off'); }}>
              Turn off Garmin
            </button>
          )}
        </div>
      )}
    </Screen>
  );
}
