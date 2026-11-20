import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { purgeOrphanPhotos, recoverStale, snapshotToday, useSettings } from './data';
import { requestPersistence } from './lib/db';
import { NavProvider, useNav, type Overlay } from './nav';
import { AddSheet } from './screens/AddSheet';
import { AiSettings } from './screens/AiSettings';
import { BackupSheet } from './screens/BackupSheet';
import { GarminSettings } from './screens/GarminSettings';
import { syncGarmin } from './lib/garminSync';
import { Badges } from './screens/Badges';
import { BarcodeScanner } from './screens/Camera';
import { Describe } from './screens/Describe';
import { Details } from './screens/Details';
import { Exercise } from './screens/Exercise';
import { FoodDetail, LookupDetail } from './screens/FoodDetail';
import { Goals } from './screens/Goals';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Progress } from './screens/Progress';
import { ProgressPhotos } from './screens/ProgressPhotos';
import { Search } from './screens/Search';
import { Settings } from './screens/Settings';
import { WeightLog } from './screens/WeightLog';
import { Icon } from './ui/Icon';

function useTheme(theme: 'system' | 'light' | 'dark' | undefined) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || ((theme ?? 'system') === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#17120F' : '#F3EDE2'));
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

/**
 * While a sheet or screen is open, freeze the page behind it. iOS otherwise scrolls the page
 * underneath whenever the overlay's own content can't scroll any further.
 */
function useScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) return;
    const y = window.scrollY;
    const b = document.body.style;
    Object.assign(b, { position: 'fixed', top: `-${y}px`, left: '0', right: '0' });
    return () => {
      Object.assign(b, { position: '', top: '', left: '', right: '' });
      window.scrollTo(0, y);
    };
  }, [locked]);
}

/** Each tab keeps its own scroll position, and tapping the tab you're on scrolls to the top, like iOS. */
function useTabScroll<T extends string>(tab: T, setTab: (t: T) => void) {
  const saved = useRef<Record<string, number>>({});
  const stopRestore = useRef(() => {});
  useLayoutEffect(() => {
    const target = saved.current[tab] ?? 0;
    window.scrollTo(0, target);
    // the tab's data loads a beat later, so keep trying until the page is tall enough
    const started = Date.now();
    const iv = window.setInterval(() => {
      if (Math.abs(window.scrollY - target) < 2 || Date.now() - started > 800) return clearInterval(iv);
      window.scrollTo(0, target);
    }, 16);
    // a finger on the screen means the user is scrolling themselves; stop fighting them
    const stop = () => clearInterval(iv);
    stopRestore.current = stop;
    window.addEventListener('touchstart', stop, { once: true, passive: true });
    return () => {
      stop();
      window.removeEventListener('touchstart', stop);
    };
  }, [tab]);
  return (next: T) => {
    stopRestore.current();
    if (next === tab) return window.scrollTo({ top: 0, behavior: 'smooth' });
    saved.current[tab] = window.scrollY;
    setTab(next);
  };
}

/** The service worker waits instead of reloading mid-use; this exposes "update now". */
function useUpdateReady(): (() => void) | null {
  const [fn, setFn] = useState<(() => void) | null>(null);
  useEffect(() => {
    const on = (e: Event) => setFn(() => (e as CustomEvent<() => void>).detail);
    window.addEventListener('morsel:update', on);
    return () => window.removeEventListener('morsel:update', on);
  }, []);
  return fn;
}

function OverlayView({ o }: { o: Overlay }) {
  switch (o.kind) {
    case 'add': return <AddSheet />;
    case 'barcode': return <BarcodeScanner />;
    case 'food': return <FoodDetail id={o.id} />;
    case 'lookup': return <LookupDetail food={o.food} source={o.source} />;
    case 'search': return <Search tab={o.tab} />;
    case 'describe': return <Describe />;
    case 'exercise': return <Exercise />;
    case 'weight': return <WeightLog />;
    case 'goals': return <Goals />;
    case 'details': return <Details />;
    case 'ai': return <AiSettings />;
    case 'badges': return <Badges />;
    case 'photos': return <ProgressPhotos />;
    case 'backup': return <BackupSheet photos={o.photos} />;
    case 'garmin': return <GarminSettings />;
  }
}

function Shell() {
  const nav = useNav();
  const settings = useSettings();
  useTheme(settings?.theme);
  useScrollLock(nav.stack.length > 0);
  const goTab = useTabScroll(nav.tab, nav.setTab);

  useEffect(() => {
    void recoverStale();
    void requestPersistence();
    void purgeOrphanPhotos();
    const sync = () => document.visibilityState === 'visible' && void syncGarmin().catch(() => {});
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // keep today's goal snapshot current with the settings
  useEffect(() => {
    if (settings) void snapshotToday();
  }, [settings, nav.date]);

  const update = useUpdateReady();

  if (settings === null) return null; // loading
  if (!settings || !settings.onboarded) return <Onboarding existing={settings} />;

  const tabs = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'progress', label: 'Progress', icon: 'chart' },
  ] as const;

  return (
    <div className="app">
      {nav.tab === 'today' && <Home />}
      {nav.tab === 'progress' && <Progress />}
      {nav.tab === 'settings' && <Settings />}

      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {tabs.map(t => (
            <button key={t.id} className="tab" aria-current={nav.tab === t.id ? 'page' : undefined} onClick={() => goTab(t.id)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
          <button className="log-btn" aria-label="Log food or exercise" onClick={() => nav.push({ kind: 'add' })}>
            <Icon name="plus" size={28} stroke={2.4} />
          </button>
          <button className="tab" onClick={() => nav.push({ kind: 'search' })}>
            <Icon name="search" />
            Foods
          </button>
          <button className="tab" aria-current={nav.tab === 'settings' ? 'page' : undefined} onClick={() => goTab('settings')}>
            <Icon name="gear" />
            Settings
          </button>
        </div>
      </nav>

      {nav.stack.map((o, i) => (
        <OverlayView key={i + o.kind} o={o} />
      ))}

      {update && (
        <div className="toast" role="status" style={{ bottom: 'auto', top: 'calc(var(--safe-top) + 8px)' }}>
          A new version of Morsel is ready.
          <button onClick={update}>Update</button>
        </div>
      )}

      {nav.toast && (
        <div className="toast" role="status" key={nav.toast.id}>
          {nav.toast.text}
          {nav.toast.action && (
            <button
              onClick={() => {
                nav.toast?.action?.run();
              }}
            >
              {nav.toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}
