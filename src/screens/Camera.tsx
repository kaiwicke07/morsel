import { useEffect, useRef, useState, type ReactNode } from 'react';
import { lookupBarcode } from '../lib/lookup/off';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { usePhotoCapture } from '../ui/usePhotoCapture';

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

/** Live barcode scanner. Meal and label photos use the iPhone camera instead (see usePhotoCapture). */
export function BarcodeScanner() {
  const nav = useNav();
  const [closing, setClosing] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [scan, setScan] = useState<{ state: 'idle' | 'looking' | 'notfound' | 'error'; code?: string; msg?: string }>({ state: 'idle' });
  const [manual, setManual] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
  const photo = usePhotoCapture(() => close());

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
    if (!ready || scan.state !== 'idle') return;
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
  }, [ready, scan.state]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div
      className="screen"
      style={{ background: '#0c0907', color: '#fff', padding: 0, overflow: 'hidden', animation: closing ? 'fade-out 200ms forwards' : 'fade-in 220ms' }}
      role="dialog"
      aria-label="Camera"
    >
      <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* guide frame */}
      {!camError && <Guide />}

      {/* top bar */}
      <div className="row between" style={{ position: 'absolute', top: 'calc(var(--safe-top) + 8px)', left: 12, right: 12 }}>
        <button className="icon-btn" style={{ background: 'rgba(0,0,0,.45)', color: '#fff', boxShadow: 'none' }} onClick={close} aria-label="Close camera">
          <Icon name="close" />
        </button>
        <span style={{ fontWeight: 600, textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>
          Scan a barcode
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
            <p style={{ opacity: 0.75, margin: 0 }}>Type the barcode number below instead, or snap the nutrition label.</p>
          </div>
        </div>
      )}

      {/* barcode status / manual entry */}
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(var(--safe-bottom) + 24px)', display: 'grid', gap: 10 }}>
          {scan.state === 'looking' && <Pill>Looking up {scan.code}…</Pill>}
          {(scan.state === 'notfound' || scan.state === 'error') && (
            <div style={{ background: 'rgba(12,9,7,.86)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
              <b>{scan.state === 'notfound' ? `No match for ${scan.code}` : scan.msg}</b>
              <span style={{ opacity: 0.75, fontSize: 14 }}>Try the nutrition label instead, or search by name.</span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm accent" onClick={() => photo.open('label')}>Scan label</button>
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
          {scan.state === 'idle' && (
            <button className="btn sm ghost" style={{ justifySelf: 'center', color: '#fff' }} onClick={() => photo.open('label')}>
              No barcode? Snap the nutrition label
            </button>
          )}
      </div>

      {photo.element}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <div style={{ justifySelf: 'center', background: 'rgba(12,9,7,.8)', padding: '10px 16px', borderRadius: 999, fontWeight: 600 }}>{children}</div>;
}

function Guide() {
  const box = { w: '82%', h: '22%' };
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
        <span style={{ position: 'absolute', left: '6%', right: '6%', top: '50%', height: 2, background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }} />
      </div>
    </div>
  );
}
