import { useEffect, useRef, useState } from 'react';
import { logPhoto, useSettings } from '../data';
import { hasAiKey } from '../lib/ai';
import { patchSettings } from '../lib/db';
import { useNav } from '../nav';
import { Sheet } from './primitives';

type Kind = 'photo' | 'label';
type Source = 'camera' | 'library';

/**
 * Photos go through the iPhone's own camera (a file input with `capture`).
 * Unlike a live getUserMedia view, that never asks for camera permission,
 * which home-screen web apps otherwise forget between launches.
 *
 * `open` must be called straight from a tap: iOS only opens the camera inside a user gesture.
 */
export function usePhotoCapture(onLogged?: () => void) {
  const nav = useNav();
  const s = useSettings();
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const kind = useRef<Kind>('photo');
  const busy = useRef(false);
  const [keyOk, setKeyOk] = useState(true);
  const [tips, setTips] = useState(false);

  useEffect(() => {
    void hasAiKey().then(setKeyOk);
  }, []);

  function open(k: Kind, source: Source = 'camera') {
    if (!keyOk) {
      nav.push({ kind: 'ai' });
      nav.showToast('Add an AI key once and photo scans just work.');
      return;
    }
    kind.current = k;
    if (source === 'camera' && k === 'photo' && s && !s.seenCameraTips) return setTips(true);
    (source === 'camera' ? camRef : libRef).current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || busy.current) return;
    busy.current = true;
    try {
      await logPhoto(nav.date, f, kind.current);
      nav.showToast(kind.current === 'label' ? 'Reading the label…' : 'Analyzing your meal…');
      onLogged?.();
    } catch {
      nav.showToast("Couldn't read that image. Try another.");
    } finally {
      busy.current = false;
    }
  }

  const element = (
    <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={libRef} type="file" accept="image/*" hidden onChange={onFile} />
      {tips && (
        <Sheet onClose={() => setTips(false)} label="Photo tips">
          {close => (
            <div>
              <h2 className="serif" style={{ fontSize: 26, margin: '0 0 16px', fontWeight: 600 }}>For the best estimate</h2>
              {[
                ['Get the whole plate in', 'Shoot from slightly above so every item and the plate edge show.'],
                ['Use good light', 'Daylight or a bright room. Turn on the flash in dim restaurants.'],
                ['One meal per photo', 'If it was two plates, take two photos or say so in Fix result.'],
              ].map(([t, d], i) => (
                <div key={t} className="row" style={{ alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <span className="num" style={{ fontSize: 22, color: 'var(--accent)', width: 18 }}>{i + 1}</span>
                  <span>
                    <b>{t}</b>
                    <span className="muted" style={{ display: 'block', fontSize: 15 }}>{d}</span>
                  </span>
                </div>
              ))}
              <button
                className="btn accent block"
                style={{ marginTop: 6 }}
                onClick={() => {
                  void patchSettings({ seenCameraTips: true });
                  camRef.current?.click(); // still inside this tap, so iOS allows it
                  close();
                }}
              >
                Got it, open camera
              </button>
            </div>
          )}
        </Sheet>
      )}
    </>
  );

  return { open, element };
}
