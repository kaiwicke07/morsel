import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LookupFood } from './lib/lookup/off';
import { rollDate, todayIso } from './lib/units';

export type Overlay =
  | { kind: 'add' }
  | { kind: 'barcode' }
  | { kind: 'food'; id: number }
  | { kind: 'lookup'; food: LookupFood; source: 'barcode' | 'search' | 'manual' }
  | { kind: 'search'; tab?: 'all' | 'saved' | 'manual' }
  | { kind: 'describe' }
  | { kind: 'exercise' }
  | { kind: 'weight' }
  | { kind: 'goals' }
  | { kind: 'details' }
  | { kind: 'ai' }
  | { kind: 'badges' }
  | { kind: 'photos' }
  | { kind: 'backup'; photos: boolean }
  | { kind: 'garmin' };

interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

interface Nav {
  tab: 'today' | 'progress' | 'settings';
  setTab: (t: Nav['tab']) => void;
  date: string;
  setDate: (d: string) => void;
  stack: Overlay[];
  push: (o: Overlay) => void;
  /** remove the top overlay (screens call this after their exit animation) */
  pop: () => void;
  /** replace the top overlay */
  replace: (o: Overlay) => void;
  /** close everything */
  reset: () => void;
  toast: Toast | null;
  showToast: (text: string, action?: Toast['action']) => void;
}

const Ctx = createContext<Nav>(null as unknown as Nav);
export const useNav = () => useContext(Ctx);

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Nav['tab']>('today');
  const [date, setDate] = useState(todayIso());
  const [stack, setStack] = useState<Overlay[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number>();
  const lastToday = useRef(todayIso());

  // iOS keeps home-screen apps alive for days: follow the calendar past midnight
  useEffect(() => {
    const check = () => {
      const now = todayIso();
      const prev = lastToday.current;
      if (now === prev) return;
      setDate(d => rollDate(d, prev, now));
      lastToday.current = now;
    };
    const iv = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  const showToast = useCallback((text: string, action?: Toast['action']) => {
    const id = Date.now();
    setToast({ id, text, action });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(t => (t?.id === id ? null : t)), 4000);
  }, []);

  const value: Nav = {
    tab,
    setTab,
    date,
    setDate,
    stack,
    push: o => setStack(s => [...s, o]),
    pop: () => setStack(s => s.slice(0, -1)),
    replace: o => setStack(s => [...s.slice(0, -1), o]),
    reset: () => setStack([]),
    toast,
    showToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
