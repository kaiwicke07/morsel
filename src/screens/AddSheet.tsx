import { useRef } from 'react';
import { useNav, type Overlay } from '../nav';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/primitives';
import { usePhotoCapture } from '../ui/usePhotoCapture';

export function AddSheet() {
  const nav = useNav();
  const going = useRef(false);
  const go = (close: () => void, o: Overlay) => {
    if (going.current) return;
    going.current = true;
    close();
    setTimeout(() => nav.push(o), 230);
  };
  const closeRef = useRef<() => void>(() => {});
  const photo = usePhotoCapture(() => closeRef.current());
  return (
    <Sheet onClose={nav.pop} label="Log something">
      {close => {
        closeRef.current = close; // the photo flow closes the sheet once the photo is logged
        return (
        <div className="stack" style={{ gap: 10 }}>
          {photo.element}
          <button
            className="card row"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)', padding: 18, gap: 14, textAlign: 'left' }}
            onClick={() => photo.open('photo')}
          >
            <span style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}>
              <Icon name="camera" size={26} />
            </span>
            <span style={{ flex: 1 }}>
              <span className="serif" style={{ fontSize: 21, fontWeight: 600, display: 'block' }}>Scan a meal</span>
              <span className="small" style={{ opacity: 0.85 }}>Opens the iPhone camera. Shoot, done.</span>
            </span>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {([
              ['barcode', 'Barcode', () => go(close, { kind: 'barcode' })],
              ['label', 'Label', () => photo.open('label')],
              ['image', 'Photos', () => photo.open('photo', 'library')],
              ['type', 'Describe', () => go(close, { kind: 'describe' })],
            ] as [string, string, () => void][]).map(([icon, label, run]) => (
              <button key={label} className="card" style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: '16px 4px', fontWeight: 600, fontSize: 14 }} onClick={run}>
                <Icon name={icon} size={26} />
                {label}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 4 }}>
            {([
              ['search', 'Search foods', 'USDA database, 300k+ foods', { kind: 'search', tab: 'all' }],
              ['bookmark', 'Saved foods', 'Your favourites, one tap', { kind: 'search', tab: 'saved' }],
              ['run', 'Exercise', 'Runs, lifting, anything', { kind: 'exercise' }],
              ['scale', 'Weight', 'Log a weigh-in', { kind: 'weight' }],
            ] as [string, string, string, Overlay][]).map(([icon, label, sub, o], i) => (
              <button
                key={label}
                className="row"
                style={{ width: '100%', padding: '14px 12px', textAlign: 'left', borderTop: i ? '1px solid var(--line)' : 'none' }}
                onClick={() => go(close, o)}
              >
                <Icon name={icon} />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, display: 'block' }}>{label}</span>
                  <span className="small muted">{sub}</span>
                </span>
                <Icon name="next" size={18} className="faint" />
              </button>
            ))}
          </div>
        </div>
        );
      }}
    </Sheet>
  );
}
