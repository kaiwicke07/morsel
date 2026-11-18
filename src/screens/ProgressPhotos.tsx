import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { usePhoto } from '../data';
import { db, type ProgressPhoto } from '../lib/db';
import { prepareImage } from '../lib/image';
import { parseIso, todayIso } from '../lib/units';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/primitives';

export function ProgressPhotos() {
  const nav = useNav();
  const rows = useLiveQuery(() => db.progressPhotos.orderBy('date').reverse().toArray(), []);
  const input = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(todayIso());
  const [open, setOpen] = useState<ProgressPhoto | null>(null);

  return (
    <Screen title="Progress photos" onClose={nav.pop}>
      {() => (
        <div className="page stack">
          <div className="card row" style={{ gap: 10 }}>
            <input className="input" type="date" value={date} max={todayIso()} onChange={e => e.target.value && setDate(e.target.value)} aria-label="Photo date" />
            <button className="btn sm accent" style={{ minHeight: 50 }} onClick={() => input.current?.click()}>
              <Icon name="plus" size={18} /> Add
            </button>
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={async e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const { full, thumb } = await prepareImage(f);
              const photoId = await db.photos.add({ full, thumb, createdAt: Date.now() });
              await db.progressPhotos.add({ date, photoId, createdAt: Date.now() });
            }}
          />
          {rows && !rows.length && <p className="muted small" style={{ textAlign: 'center' }}>Add a photo every couple of weeks. Changes you can't see in the mirror show up side by side.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {rows?.map(r => <Tile key={r.id} r={r} onOpen={() => setOpen(r)} />)}
          </div>
          {open && <Viewer r={open} onClose={() => setOpen(null)} />}
        </div>
      )}
    </Screen>
  );
}

function Tile({ r, onOpen }: { r: ProgressPhoto; onOpen: () => void }) {
  const src = usePhoto(r.photoId);
  return (
    <button onClick={onOpen} style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden', background: 'var(--card-2)' }}>
      {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <span className="small" style={{ position: 'absolute', left: 6, bottom: 6, background: 'rgba(0,0,0,.55)', color: '#fff', borderRadius: 6, padding: '1px 6px' }}>
        {parseIso(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
    </button>
  );
}

function Viewer({ r, onClose }: { r: ProgressPhoto; onClose: () => void }) {
  const src = usePhoto(r.photoId, 'full');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#000', display: 'grid', placeItems: 'center' }} onClick={onClose}>
      {src && <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} />}
      <div className="row" style={{ position: 'absolute', top: 'calc(var(--safe-top) + 10px)', right: 12, gap: 8 }}>
        <button
          className="icon-btn"
          aria-label="Delete photo"
          onClick={async e => {
            e.stopPropagation();
            if (!confirm('Delete this photo?')) return;
            await db.progressPhotos.delete(r.id!);
            await db.photos.delete(r.photoId);
            onClose();
          }}
        >
          <Icon name="trash" size={20} />
        </button>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
