import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { stepServings } from '../lib/day';
import { Icon } from './Icon';

/** Plays the exit animation before calling onClose. */
function useClosing(onClose: () => void, ms = 210) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, ms);
  };
  return { closing, close };
}

export function Sheet({ onClose, children, label }: { onClose: () => void; children: (close: () => void) => ReactNode; label: string }) {
  const { closing, close } = useClosing(onClose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <>
      <div className={`scrim ${closing ? 'closing' : ''}`} onClick={close} />
      <div className={`sheet ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        <div className="grabber" />
        {children(close)}
      </div>
    </>
  );
}

export function Screen({
  title,
  onClose,
  right,
  children,
}: {
  title?: string;
  onClose: () => void;
  right?: (close: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const { closing, close } = useClosing(onClose);
  return (
    <div className={`screen ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="screen-head">
        <button className="icon-btn" onClick={close} aria-label="Back">
          <Icon name="back" />
        </button>
        <h1>{title}</h1>
        <div>{right?.(close)}</div>
      </div>
      {children(close)}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)} />;
}

export function Meter({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  const k = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className={`meter ${value > max && max > 0 ? 'over' : ''}`} style={{ height, ['--c' as string]: color }}>
      <span style={{ transform: `scaleX(${k})` }} />
    </div>
  );
}

export function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, ''));
  return (
    <div className="row" style={{ gap: 4, background: 'var(--card-2)', borderRadius: 999, padding: 4 }}>
      <button className="icon-btn" style={{ width: 34, height: 34 }} aria-label="Fewer servings" onClick={() => onChange(stepServings(value, -1))}>
        <Icon name="minus" size={18} />
      </button>
      <span className="num" style={{ minWidth: 40, textAlign: 'center', fontSize: 18, fontWeight: 600 }}>
        {fmt(value)}
      </span>
      <button className="icon-btn" style={{ width: 34, height: 34 }} aria-label="More servings" onClick={() => onChange(stepServings(value, 1))}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

/** Horizontal ruler picker. Scroll position maps to value; snaps to `step`. */
export function Ruler({ value, onChange, min, max, step, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const TICK = 10;
  const count = Math.round((max - min) / step);
  const settling = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || settling.current) return;
    el.scrollLeft = ((value - min) / step) * TICK;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const el = ref.current!;
    settling.current = true;
    const i = Math.round(el.scrollLeft / TICK);
    const v = +(min + Math.min(count, Math.max(0, i)) * step).toFixed(2);
    if (v !== value) onChange(v);
  };

  const ticks = [];
  const majorEvery = Math.round(1 / step) * (step < 1 ? 5 : 10);
  for (let i = 0; i <= count; i++) {
    const major = i % majorEvery === 0;
    ticks.push(
      <div key={i} style={{ width: TICK, flex: 'none', position: 'relative', height: 56 }}>
        <div style={{ position: 'absolute', left: TICK / 2 - 1, bottom: 0, width: 2, borderRadius: 2, height: major ? 34 : i % (majorEvery / 2) === 0 ? 24 : 14, background: major ? 'var(--ink-2)' : 'var(--line)' }} />
        {major && (
          <span className="faint num small" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
            {Math.round(min + i * step)}
          </span>
        )}
      </div>,
    );
  }
  return (
    <div style={{ position: 'relative' }}>
      <div className="num" style={{ textAlign: 'center', fontSize: 52, fontWeight: 600, lineHeight: 1 }}>
        {value.toFixed(1)}
        <span className="muted" style={{ fontSize: 20, marginLeft: 6, fontFamily: 'var(--sans)' }}>
          {unit}
        </span>
      </div>
      <div
        ref={ref}
        onScroll={onScroll}
        style={{
          marginTop: 18,
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          paddingInline: 'calc(50% - 5px)',
          maskImage: 'linear-gradient(90deg, transparent, #000 25%, #000 75%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 25%, #000 75%, transparent)',
        }}
      >
        {ticks.map((t, i) => (
          <div key={i} style={{ scrollSnapAlign: 'center' }}>
            {t}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: '50%', bottom: 0, width: 3, height: 44, marginLeft: -1.5, borderRadius: 3, background: 'var(--accent)', pointerEvents: 'none' }} />
    </div>
  );
}

export function SegTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="tablist" style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, background: 'var(--card-2)', borderRadius: 12, padding: 3 }}>
      {options.map(o => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          style={{
            minHeight: 36,
            borderRadius: 9,
            fontSize: 14,
            fontWeight: 600,
            color: o.value === value ? 'var(--ink)' : 'var(--ink-2)',
            background: o.value === value ? 'var(--card)' : 'transparent',
            boxShadow: o.value === value ? 'var(--shadow)' : 'none',
            transition: 'background 160ms, color 160ms',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Thumb({ src, size = 64, radius = 14 }: { src?: string; size?: number; radius?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', background: 'var(--card-2)', flex: 'none', display: 'grid', placeItems: 'center' }}>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PlateGlyph />}
    </div>
  );
}

export function PlateGlyph({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="2 2.4" />
    </svg>
  );
}
