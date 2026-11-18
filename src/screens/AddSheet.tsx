import { useNav, type Overlay } from '../nav';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/primitives';

export function AddSheet() {
  const nav = useNav();
  const go = (close: () => void, o: Overlay) => {
    close();
    setTimeout(() => nav.push(o), 230);
  };
  return (
    <Sheet onClose={nav.pop} label="Log something">
      {close => (
        <div className="stack" style={{ gap: 10 }}>
          <button
            className="card row"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)', padding: 18, gap: 14, textAlign: 'left' }}
            onClick={() => go(close, { kind: 'camera', mode: 'food' })}
          >
            <span style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}>
              <Icon name="camera" size={26} />
            </span>
            <span style={{ flex: 1 }}>
              <span className="serif" style={{ fontSize: 21, fontWeight: 600, display: 'block' }}>Scan a meal</span>
              <span className="small" style={{ opacity: 0.85 }}>Point, shoot, done. Or pick from your photos.</span>
            </span>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {([
              ['barcode', 'Barcode', { kind: 'camera', mode: 'barcode' }],
              ['label', 'Label', { kind: 'camera', mode: 'label' }],
              ['type', 'Describe', { kind: 'describe' }],
            ] as [string, string, Overlay][]).map(([icon, label, o]) => (
              <button key={label} className="card" style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: '16px 8px', fontWeight: 600, fontSize: 15 }} onClick={() => go(close, o)}>
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
      )}
    </Sheet>
  );
}
