import { useRef, type ReactNode } from 'react';
import { baseTargets, useCurrentWeight, useSettings } from '../data';
import { exportBackup, importBackup } from '../lib/backup';
import { db, patchSettings, type Settings as S } from '../lib/db';
import { ageOn, cmToFtIn, fmtWeight, todayIso } from '../lib/units';
import { useNav, type Overlay } from '../nav';
import { Icon } from '../ui/Icon';
import { SegTabs, Toggle } from '../ui/primitives';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2 className="tiny faint" style={{ margin: '26px 4px 8px' }}>{title}</h2>
      <div className="card" style={{ padding: '2px 0' }}>{children}</div>
    </>
  );
}

function Row({ icon, label, value, onClick, right, first }: { icon?: string; label: string; value?: ReactNode; onClick?: () => void; right?: ReactNode; first?: boolean }) {
  const inner = (
    <>
      {icon && <Icon name={icon} size={20} />}
      <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
      {value !== undefined && <span className="muted small">{value}</span>}
      {right ?? (onClick && <Icon name="next" size={16} className="faint" />)}
    </>
  );
  const style = { width: '100%', padding: '14px 16px', textAlign: 'left' as const, borderTop: first ? 'none' : '1px solid var(--line)', minHeight: 54 };
  return onClick ? (
    <button className="row" style={style} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="row" style={style}>
      {inner}
    </div>
  );
}

async function shareOrDownload(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function Settings() {
  const s = useSettings();
  const nav = useNav();
  const weight = useCurrentWeight(s);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!s) return null;
  const p = s.profile;
  const t = baseTargets(s);
  const go = (o: Overlay) => () => nav.push(o);
  const setProfile = (x: Partial<S['profile']>) => patchSettings({ profile: { ...p, ...x } });
  const { ft, inch } = cmToFtIn(p.heightCm);
  const keyOn = s.ai.provider === 'gemini' ? !!s.ai.geminiKey : !!s.ai.claudeKey;

  return (
    <div className="page" style={{ paddingBottom: 20 }}>
      <h1 className="serif" style={{ fontSize: 34, fontWeight: 600, margin: '6px 0 6px' }}>Settings</h1>

      <Group title="You">
        <Row first icon="heart" label="Personal details" value={`${ageOn(p.birthday, new Date())} · ${p.units === 'imperial' ? `${ft}′${inch}″` : `${Math.round(p.heightCm)} cm`} · ${weight ? fmtWeight(weight, p.units, 0) : ''}`} onClick={go({ kind: 'details' })} />
        <Row icon="chart" label="Nutrition goals" value={`${t.kcal.toLocaleString()} cal`} onClick={go({ kind: 'goals' })} />
        <Row icon="scale" label="Log weight" onClick={go({ kind: 'weight' })} />
      </Group>

      <Group title="Tracking">
        <Row first label="Add burned calories to my budget" right={<Toggle label="Add burned calories" checked={p.addBurned} onChange={v => setProfile({ addBurned: v })} />} />
        <Row label="Roll over up to 200 unused calories" right={<Toggle label="Rollover calories" checked={p.rollover} onChange={v => setProfile({ rollover: v })} />} />
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
          <div className="small muted" style={{ marginBottom: 8 }}>Units</div>
          <SegTabs value={p.units} onChange={v => setProfile({ units: v })} options={[{ value: 'imperial', label: 'lb · ft · oz' }, { value: 'metric', label: 'kg · cm · ml' }]} />
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
          <div className="small muted" style={{ marginBottom: 8 }}>Appearance</div>
          <SegTabs value={s.theme} onChange={v => patchSettings({ theme: v })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </div>
      </Group>

      <Group title="Scanning">
        <Row first icon="key" label="AI provider & key" value={keyOn ? (s.ai.provider === 'claude' ? 'Claude' : 'Gemini') : 'Not set'} onClick={go({ kind: 'ai' })} />
        <Row icon="camera" label="Show camera tips again" onClick={() => { void patchSettings({ seenCameraTips: false }); nav.showToast('Tips will show next time you scan'); }} />
      </Group>

      <Group title="Your data">
        <Row first icon="download" label="Back up (without photos)" onClick={async () => shareOrDownload(await exportBackup(false), `morsel-backup-${todayIso()}.json`)} />
        <Row icon="download" label="Back up with photos" onClick={async () => shareOrDownload(await exportBackup(true), `morsel-backup-photos-${todayIso()}.json`)} />
        <Row icon="upload" label="Restore from backup" onClick={() => fileRef.current?.click()} />
        <Row icon="refresh" label="Redo setup questions" onClick={() => patchSettings({ onboarded: false })} />
        <Row
          icon="trash"
          label="Erase everything"
          onClick={async () => {
            if (!confirm('Erase all meals, weights, photos and settings on this phone? This cannot be undone.')) return;
            await db.delete();
            location.reload();
          }}
        />
      </Group>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (!confirm('Replace everything on this phone with this backup?')) return;
          try {
            await importBackup(f);
            nav.showToast('Backup restored');
          } catch (err) {
            nav.showToast(err instanceof Error ? err.message : 'Restore failed');
          }
        }}
      />

      <p className="small faint" style={{ textAlign: 'center', marginTop: 26, lineHeight: 1.6 }}>
        Morsel 1.0 · everything is stored on this phone
        <br />
        Food data: USDA FoodData Central, Open Food Facts
        <br />
        Estimates only, not medical advice.
      </p>
    </div>
  );
}
