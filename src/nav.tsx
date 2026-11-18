import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { LookupFood } from './lib/lookup/off';
import { todayIso } from './lib/units';

export type CameraMode = 'food' | 'barcode' | 'label';

export type Overlay =
  | { kind: 'add' }
  | { kind: 'camera'; mode: CameraMode }
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
  | { kind: 'photos' };

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
