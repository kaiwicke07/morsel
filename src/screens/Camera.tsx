import { useEffect, useRef, useState, type ReactNode } from 'react';
import { logPhoto, useSettings } from '../data';
import { hasAiKey } from '../lib/ai';
import { patchSettings } from '../lib/db';
import { lookupBarcode } from '../lib/lookup/off';
import { useNav, type CameraMode } from '../nav';
import { Icon } from '../ui/Icon';

type Detector = (c: HTMLCanvasElement) => Promise<string | null>;

async function makeDetector(): Promise<Detector> {
  const BD = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
  if (BD) {
    try {
      const formats = await BD.getSupportedFormats();
      const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(f => formats.includes(f));
      if (want.length) {
        const d = new BD({ formats: want });
        return async c => (await d.detect(c))[0]?.rawValue ?? null;
      }
    } catch {
      /* fall through to zxing */
    }
  }
  const [{ BrowserMultiFormatReader }, lib] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map();
  hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [lib.BarcodeFormat.EAN_13, lib.BarcodeFormat.EAN_8, lib.BarcodeFormat.UPC_A, lib.BarcodeFormat.UPC_E]);
  hints.set(lib.DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  return async c => {
    try {
      return reader.decodeFromCanvas(c).getText();
    } catch {
      return null;
    }
  };
}

export function Camera({ mode: initial }: { mode: CameraMode }) {
  const nav = useNav();
  const s = useSettings();
  const [mode, setMode] = useState<CameraMode>(initial);
  const [closing, setClosing] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [scan, setScan] = useState<{ state: 'idle' | 'looking' | 'notfound' | 'error'; code?: string; msg?: string }>({ state: 'idle' });
  const [manual, setManual] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  const closingRef = useRef(false);
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(nav.pop, 200);
  };
  /** leave the camera for another overlay, at most once */
  const leaveTo = (o: Parameters<typeof nav.replace>[0]) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => nav.replace(o), 180);
  };
  const [keyOk, setKeyOk] = useState(true);
  useEffect(() => {
    void hasAiKey().then(setKeyOk);
  }, []);

  // start the camera
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError('This browser has no live camera access.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach(t => t.stop());
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play().catch(() => {});
        setReady(true);
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (caps.torch) setTorch(false);
      } catch (e) {
        setCamError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Camera access is off for Morsel.' : "Couldn't start the camera.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // barcode loop
  useEffect(() => {
    if (mode !== 'barcode' || !ready || scan.state !== 'idle') return;
    let stop = false;
    let timer = 0;
    const canvas = document.createElement('canvas');
    (async () => {
      const detect = await makeDetector();
      const tick = async () => {
        if (stop) return;
        const v = videoRef.current;
        if (v && v.videoWidth) {
          // crop the centre band where the guide is drawn
          const w = v.videoWidth, h = v.videoHeight;
          const cw = Math.round(w * 0.9), ch = Math.round(h * 0.45);
          canvas.width = cw;
          canvas.height = ch;
          canvas.getContext('2d', { willReadFrequently: true })!.drawImage(v, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
          const code = await detect(canvas);
          if (code && !stop) {
            navigator.vibrate?.(30);
            void handleCode(code);
            return;
          }
        }
        timer = window.setTimeout(tick, 220);
      };
      void tick();
    })();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [mode, ready, scan.state]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCode(code: string) {
    setScan({ state: 'looking', code });
    try {
      const food = await lookupBarcode(code);
      if (closingRef.current) return; // user left while we were looking it up
      if (!food) return setScan({ state: 'notfound', code });
      leaveTo({ kind: 'lookup', food, source: 'barcode' });
    } catch (e) {
      setScan({ state: 'error', code, msg: e instanceof Error ? e.message : 'Lookup failed' });
    }
  }

  async function submit(blob: Blob) {
    if (busy.current) return;
    busy.current = true;
    try {
      await logPhoto(nav.date, blob, mode === 'label' ? 'label' : 'photo');
      nav.showToast(mode === 'label' ? 'Reading the label…' : 'Analyzing your meal…');
      close();
    } catch {
      nav.showToast("Couldn't read that image. Try another.");
      busy.current = false;
    }
  }

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return captureRef.current?.click();
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    navigator.vibrate?.(15);
    c.toBlob(b => b && submit(b), 'image/jpeg', 0.9);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      setTorch(null);
    }
  }

  const showTips = s && !s.seenCameraTips && mode === 'food';

  return (
    <div
      className="screen"
      style={{ background: '#0c0907', color: '#fff', padding: 0, overflow: 'hidden', animation: closing ? 'fade-out 200ms forwards' : 'fade-in 220ms' }}
      role="dialog"
      aria-label="Camera"
    >
      <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* guide frame */}
      {!camError && <Guide mode={mode} />}

      {/* top bar */}
      <div className="row between" style={{ position: 'absolute', top: 'calc(var(--safe-top) + 8px)', left: 12, right: 12 }}>
        <button className="icon-btn" style={{ background: 'rgba(0,0,0,.45)', color: '#fff', boxShadow: 'none' }} onClick={close} aria-label="Close camera">
          <Icon name="close" />
        </button>
        <span style={{ fontWeight: 600, textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>
          {mode === 'food' ? 'Scan a meal' : mode === 'barcode' ? 'Scan a barcode' : 'Scan a nutrition label'}
        </span>
        {torch !== null ? (
          <button className="icon-btn" style={{ background: torch ? '#fff' : 'rgba(0,0,0,.45)', color: torch ? '#000' : '#fff', boxShadow: 'none' }} onClick={toggleTorch} aria-label="Flash">
            <Icon name="flash" />
          </button>
        ) : (
          <span style={{ width: 40 }} />
        )}
      </div>

      {camError && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center' }}>
          <div className="stack" style={{ justifyItems: 'center' }}>
            <Icon name="camera" size={40} />
            <div className="serif" style={{ fontSize: 22 }}>{camError}</div>
            <p style={{ opacity: 0.75, margin: 0 }}>
              {mode === 'barcode' ? 'Type the barcode number below instead, or turn on camera access in iPhone Settings.' : 'Use the button below to take a photo with the iPhone camera.'}
            </p>
            {mode !== 'barcode' && (
              <button className="btn accent" onClick={() => captureRef.current?.click()}>
                Take a photo
              </button>
            )}
          </div>
        </div>
      )}

      {/* barcode status / manual entry */}
      {mode === 'barcode' && (
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(var(--safe-bottom) + 150px)', display: 'grid', gap: 10 }}>
          {scan.state === 'looking' && <Pill>Looking up {scan.code}…</Pill>}
          {(scan.state === 'notfound' || scan.state === 'error') && (
            <div style={{ background: 'rgba(12,9,7,.86)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
              <b>{scan.state === 'notfound' ? `No match for ${scan.code}` : scan.msg}</b>
              <span style={{ opacity: 0.75, fontSize: 14 }}>Try the nutrition label instead, or search by name.</span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm accent" onClick={() => { setScan({ state: 'idle' }); setMode('label'); }}>Scan label</button>
                <button className="btn sm ghost" onClick={() => leaveTo({ kind: 'search', tab: 'all' })}>Search</button>
                <button className="btn sm ghost" onClick={() => leaveTo({ kind: 'search', tab: 'manual' })}>Add by hand</button>
                <button className="btn sm ghost" onClick={() => setScan({ state: 'idle' })}>Retry</button>
              </div>
            </div>
          )}
          {scan.state === 'idle' && (
            <form
              className="row"
              style={{ gap: 8 }}
              onSubmit={e => {
                e.preventDefault();
                const c = manual.replace(/\D/g, '');
                if (c.length >= 8) void handleCode(c);
              }}
            >
              <input
                className="input num"
                inputMode="numeric"
                placeholder="Or type the barcode number"
                value={manual}
                onChange={e => setManual(e.target.value)}
                style={{ background: 'rgba(12,9,7,.7)', borderColor: 'rgba(255,255,255,.2)', color: '#fff' }}
                enterKeyHint="search"
              />
              <button className="btn sm accent" style={{ minHeight: 50 }} disabled={manual.replace(/\D/g, '').length < 8}>
                Go
              </button>
            </form>
          )}
        </div>
      )}

      {/* bottom controls */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 16px calc(var(--safe-bottom) + 14px)', background: 'linear-gradient(transparent, rgba(0,0,0,.65) 40%)' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 6, marginBottom: 16 }}>
          {([
            ['food', 'Meal'],
            ['barcode', 'Barcode'],
            ['label', 'Label'],
          ] as [CameraMode, string][]).map(([m, l]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setScan({ state: 'idle' }); }}
              style={{ padding: '8px 14px', borderRadius: 999, fontWeight: 600, fontSize: 14, background: mode === m ? '#fff' : 'rgba(255,255,255,.14)', color: mode === m ? '#000' : '#fff' }}
            >
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={mode === 'barcode' || !keyOk}
            style={{ justifySelf: 'start', display: 'grid', justifyItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, opacity: mode === 'barcode' || !keyOk ? 0.3 : 1 }}
          >
            <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center' }}>
              <Icon name="image" />
            </span>
            Photos
          </button>
          <button
            aria-label="Take photo"
            onClick={shoot}
            disabled={mode === 'barcode' || !keyOk}
            style={{ width: 78, height: 78, borderRadius: 999, border: '4px solid #fff', display: 'grid', placeItems: 'center', opacity: mode === 'barcode' || !keyOk ? 0.3 : 1, transition: 'transform 120ms var(--ease-out)' }}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(.92)')}
            onPointerUp={e => (e.currentTarget.style.transform = '')}
            onPointerLeave={e => (e.currentTarget.style.transform = '')}
          >
            <span style={{ width: 62, height: 62, borderRadius: 999, background: 'var(--accent)' }} />
          </button>
          <span />
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void submit(f); e.target.value = ''; }} />
      <input ref={captureRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void submit(f); e.target.value = ''; }} />

      {!keyOk && mode !== 'barcode' && (
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(var(--safe-bottom) + 160px)', background: 'rgba(12,9,7,.9)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
          <b>Photo scanning needs an AI key</b>
          <span style={{ opacity: 0.75, fontSize: 14 }}>Add a Claude or free Gemini key once and every scan after that just works. Barcodes work without one.</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm accent" onClick={() => leaveTo({ kind: 'ai' })}>Add key</button>
            <button className="btn sm ghost" onClick={() => setMode('barcode')}>Scan barcode</button>
          </div>
        </div>
      )}

      {showTips && keyOk && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,9,7,.88)', display: 'grid', alignContent: 'end', padding: '24px 20px calc(var(--safe-bottom) + 24px)' }} className="rise">
          <h2 className="serif" style={{ fontSize: 30, margin: '0 0 18px', fontWeight: 600 }}>For the best estimate</h2>
          {[
            ['Get the whole plate in', 'Shoot from slightly above so every item and the plate edge show.'],
            ['Use good light', 'Daylight or a bright room. Turn the flash on in dim restaurants.'],
            ['One meal per photo', 'If it was two plates, take two photos or say so in Fix result.'],
          ].map(([t, d], i) => (
            <div key={t} className="row" style={{ alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <span className="num" style={{ fontSize: 22, color: 'var(--accent)', width: 18 }}>{i + 1}</span>
              <span>
                <b>{t}</b>
                <span style={{ display: 'block', opacity: 0.75, fontSize: 15 }}>{d}</span>
              </span>
            </div>
          ))}
          <button className="btn accent block" style={{ marginTop: 8 }} onClick={() => patchSettings({ seenCameraTips: true })}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <div style={{ justifySelf: 'center', background: 'rgba(12,9,7,.8)', padding: '10px 16px', borderRadius: 999, fontWeight: 600 }}>{children}</div>;
}

function Guide({ mode }: { mode: CameraMode }) {
  const box = mode === 'barcode' ? { w: '82%', h: '22%' } : mode === 'label' ? { w: '72%', h: '56%' } : { w: '84%', h: '50%' };
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', transform: 'translateY(-6%)' }}>
      <div style={{ width: box.w, height: box.h, position: 'relative', transition: 'width 300ms var(--ease-out), height 300ms var(--ease-out)' }}>
        {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
          <span
            key={c}
            style={{
              position: 'absolute',
              width: 34,
              height: 34,
              borderColor: '#fff',
              borderStyle: 'solid',
              borderWidth: 0,
              ...(c[0] === 't' ? { top: 0, borderTopWidth: 4 } : { bottom: 0, borderBottomWidth: 4 }),
              ...(c[1] === 'l' ? { left: 0, borderLeftWidth: 4 } : { right: 0, borderRightWidth: 4 }),
              borderRadius: c === 'tl' ? '14px 0 0 0' : c === 'tr' ? '0 14px 0 0' : c === 'bl' ? '0 0 0 14px' : '0 0 14px 0',
            }}
          />
        ))}
        {mode === 'barcode' && <span style={{ position: 'absolute', left: '6%', right: '6%', top: '50%', height: 2, background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }} />}
      </div>
    </div>
  );
}
