import { useEffect } from 'react';
import { recoverStale, useSettings } from './data';
import { requestPersistence } from './lib/db';
import { NavProvider, useNav, type Overlay } from './nav';
import { AddSheet } from './screens/AddSheet';
import { AiSettings } from './screens/AiSettings';
import { Badges } from './screens/Badges';
import { Camera } from './screens/Camera';
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

function OverlayView({ o }: { o: Overlay }) {
  switch (o.kind) {
    case 'add': return <AddSheet />;
    case 'camera': return <Camera mode={o.mode} />;
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
  }
}

function Shell() {
  const nav = useNav();
  const settings = useSettings();
  useTheme(settings?.theme);

  useEffect(() => {
    void recoverStale();
    void requestPersistence();
  }, []);

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
            <button key={t.id} className="tab" aria-current={nav.tab === t.id ? 'page' : undefined} onClick={() => nav.setTab(t.id)}>
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
          <button className="tab" aria-current={nav.tab === 'settings' ? 'page' : undefined} onClick={() => nav.setTab('settings')}>
            <Icon name="gear" />
            Settings
          </button>
        </div>
      </nav>

      {nav.stack.map((o, i) => (
        <OverlayView key={i + o.kind} o={o} />
      ))}

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
