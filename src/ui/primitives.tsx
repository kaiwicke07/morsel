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

/**
 * Native-style dismiss gesture: drag a sheet down, or swipe a screen in from the left edge.
 * Follows the finger, then either finishes the close (from where the finger left it) or springs back.
 */
function useDragDismiss(ref: React.RefObject<HTMLElement>, axis: 'y' | 'x', onDismiss: () => void, scrim?: React.RefObject<HTMLElement>) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;
    let state: 'idle' | 'drag' | 'off' = 'idle';
    let d = 0;
    const size = () => (axis === 'y' ? el.offsetHeight : el.offsetWidth);
    const paint = (v: number) => {
      el.style.transform = v ? (axis === 'y' ? `translateY(${v}px)` : `translateX(${v}px)`) : '';
      if (scrim?.current) scrim.current.style.opacity = String(1 - Math.min(1, v / size()));
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length > 1) return (state = 'off');
      // a screen only swipes back from its left edge, like iOS
      if (axis === 'x' && t.clientX > 28) return (state = 'off');
      start = { x: t.clientX, y: t.clientY, t: performance.now() };
      state = 'idle';
      d = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start || state === 'off') return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const main = axis === 'y' ? dy : dx;
      const cross = axis === 'y' ? dx : dy;
      if (state === 'idle') {
        if (Math.abs(main) < 6 && Math.abs(cross) < 6) return;
        // only take over when the gesture is mostly along our axis, in the closing direction,
        // and (for sheets) the content is already scrolled to the top
        const atTop = axis === 'x' || el.scrollTop <= 0;
        if (main > 0 && Math.abs(main) > Math.abs(cross) && atTop) {
          state = 'drag';
          el.style.transition = 'none';
          start = { ...start, x: t.clientX, y: t.clientY }; // no jump when the drag starts
        } else return (state = 'off');
      }
      e.preventDefault(); // we own this gesture now: don't scroll the content too
      d = Math.max(0, axis === 'y' ? t.clientY - start.y : t.clientX - start.x);
      paint(d);
    };
    const onEnd = () => {
      if (state === 'drag' && start) {
        const v = d / Math.max(1, performance.now() - start.t); // px per ms
        if (d > size() * (axis === 'y' ? 0.25 : 0.35) || v > 0.5) {
          navigator.vibrate?.(8);
          dismiss.current(); // the closing animation runs on from the current position
        } else {
          el.style.transition = 'transform 320ms var(--ease-drawer)';
          if (scrim?.current) scrim.current.style.transition = 'opacity 320ms var(--ease-drawer)';
          paint(0);
          if (scrim?.current) scrim.current.style.opacity = '';
        }
      }
      start = null;
      state = 'idle';
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [ref, axis, scrim]);
}

export function Sheet({ onClose, children, label }: { onClose: () => void; children: (close: () => void) => ReactNode; label: string }) {
  const { closing, close } = useClosing(onClose);
  const ref = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  useDragDismiss(ref, 'y', close, scrim);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <>
      <div ref={scrim} className={`scrim ${closing ? 'closing' : ''}`} onClick={close} />
      <div ref={ref} className={`sheet ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
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
  const ref = useRef<HTMLDivElement>(null);
  useDragDismiss(ref, 'x', close);
  return (
    <div ref={ref} className={`screen ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
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
