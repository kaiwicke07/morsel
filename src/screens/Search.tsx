import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { logLookup, logSaved, usePhoto, useSettings } from '../data';
import { db, type SavedFood } from '../lib/db';
import type { LookupFood } from '../lib/lookup/off';
import { searchUsda } from '../lib/lookup/usda';
import type { Nutrients } from '../lib/types';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { Screen, SegTabs, Thumb } from '../ui/primitives';

type Tab = 'all' | 'saved' | 'manual';

export function Search({ tab: initial = 'all' }: { tab?: Tab }) {
  const nav = useNav();
  const [tab, setTab] = useState<Tab>(initial);
  return (
    <Screen title="Foods" onClose={nav.pop}>
      {close => (
        <div className="page">
          <SegTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'Search' },
              { value: 'saved', label: 'Saved' },
              { value: 'manual', label: 'Create' },
            ]}
          />
          <div style={{ marginTop: 14 }}>
            {tab === 'all' && <SearchTab />}
            {tab === 'saved' && <SavedTab close={close} />}
            {tab === 'manual' && <ManualTab close={close} />}
          </div>
        </div>
      )}
    </Screen>
  );
}

function SearchTab() {
  const nav = useNav();
  const s = useSettings();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<LookupFood[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const saved = useLiveQuery(() => db.saved.toArray(), []);
  const savedHits = q.trim().length > 1 ? (saved ?? []).filter(f => f.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 4) : [];

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      setErr(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        setResults(await searchUsda(term, s?.usdaKey, ctrl.signal));
      } catch (e) {
        if (!ctrl.signal.aborted) setErr(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, s?.usdaKey]);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          autoFocus
          type="search"
          placeholder="Search foods, e.g. greek yogurt"
          value={q}
          onChange={e => setQ(e.target.value)}
          enterKeyHint="search"
          autoCorrect="off"
          style={{ paddingLeft: 42 }}
        />
        <span style={{ position: 'absolute', left: 13, top: 14 }} className="faint">
          <Icon name="search" size={20} />
        </span>
      </div>

      {savedHits.map(f => (
        <SavedRow key={'s' + f.id} f={f} onLog={async () => { await logSaved(nav.date, f); nav.showToast(`Logged ${f.name}`); }} />
      ))}

      {loading && !results && [0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 62, borderRadius: 14 }} />)}
      {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
      {results && results.length === 0 && !loading && (
        <div className="card small muted" style={{ textAlign: 'center' }}>
          Nothing found. Try fewer words, or{' '}
          <button style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => nav.replace({ kind: 'describe' })}>
            describe it
          </button>{' '}
          and let the AI estimate.
        </div>
      )}
      {results && results.length > 0 && (
        <div className="card" style={{ padding: 4, opacity: loading ? 0.6 : 1 }}>
          {results.map((f, i) => (
            <div key={f.key} className="row" style={{ padding: '10px 10px 10px 12px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <button style={{ flex: 1, minWidth: 0, textAlign: 'left' }} onClick={() => nav.push({ kind: 'lookup', food: f, source: 'search' })}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span className="num">{f.per.kcal}</span> cal · {f.amount}
                  {f.brand ? ` · ${f.brand}` : ''}
                </div>
              </button>
              <button
                className="icon-btn"
                style={{ width: 36, height: 36 }}
                aria-label={`Log ${f.name}`}
                onClick={async () => {
                  await logLookup(nav.date, f, 1, 'search');
                  nav.showToast(`Logged ${f.name}`);
                }}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      {!q && (
        <p className="small faint" style={{ textAlign: 'center', marginTop: 12 }}>
          Data from USDA FoodData Central. Values are per 100 g unless a brand lists a serving.
        </p>
      )}
    </div>
  );
}

function SavedRow({ f, onLog }: { f: SavedFood; onLog: () => void }) {
  const thumb = usePhoto(f.photoId);
  const nav = useNav();
  return (
    <div className="card row" style={{ padding: 10 }}>
      <Thumb src={thumb} size={48} radius={12} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
        <div className="small muted">
          <span className="num">{Math.round(f.per.kcal)}</span> cal · {f.amount}
        </div>
      </div>
      <button className="icon-btn flat" aria-label={`Delete ${f.name}`} onClick={() => { void db.saved.delete(f.id!); nav.showToast('Removed from saved', { label: 'Undo', run: () => void db.saved.put(f) }); }}>
        <Icon name="trash" size={18} />
      </button>
      <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`Log ${f.name}`} onClick={onLog}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

function SavedTab({ close }: { close: () => void }) {
  const nav = useNav();
  const saved = useLiveQuery(() => db.saved.orderBy('uses').reverse().toArray(), []);
  if (!saved) return null;
  if (!saved.length)
    return (
      <div className="card" style={{ textAlign: 'center', padding: 28, boxShadow: 'none', background: 'transparent', border: '1.5px dashed var(--line)' }}>
        <Icon name="bookmark" size={28} />
        <p className="muted small">Tap the bookmark on any logged meal to keep it here for one-tap logging.</p>
      </div>
    );
  return (
    <div className="stack" style={{ gap: 10 }}>
      {saved.map(f => (
        <SavedRow key={f.id} f={f} onLog={async () => { await logSaved(nav.date, f); close(); nav.showToast(`Logged ${f.name}`); }} />
      ))}
    </div>
  );
}

function ManualTab({ close }: { close: () => void }) {
  const nav = useNav();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('1 serving');
  const [n, setN] = useState<Record<keyof Nutrients, string>>({ kcal: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '', sodium: '' });
  const [save, setSave] = useState(true);
  const rows: [keyof Nutrients, string, string][] = [
    ['kcal', 'Calories', 'cal'],
    ['protein', 'Protein', 'g'],
    ['carbs', 'Carbs', 'g'],
    ['fat', 'Fat', 'g'],
    ['fiber', 'Fiber', 'g'],
    ['sugar', 'Sugar', 'g'],
    ['sodium', 'Sodium', 'mg'],
  ];
  const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
  const per: Nutrients = { kcal: num(n.kcal), protein: num(n.protein), carbs: num(n.carbs), fat: num(n.fat), fiber: num(n.fiber), sugar: num(n.sugar), sodium: num(n.sodium) };

  return (
    <form
      className="stack"
      onSubmit={async e => {
        e.preventDefault();
        const food: LookupFood = { key: 'manual', name: name.trim(), amount: amount.trim() || '1 serving', per, healthScore: 5 };
        await logLookup(nav.date, food, 1, 'manual');
        if (save) await db.saved.add({ name: food.name, amount: food.amount, per, ingredients: [{ name: food.name, amount: food.amount, ...per }], healthScore: 5, createdAt: Date.now(), uses: 1 });
        close();
        nav.showToast(`Logged ${food.name}`);
      }}
    >
      <div className="field">
        <label htmlFor="m-name">Name</label>
        <input id="m-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Mom's lasagna" />
      </div>
      <div className="field">
        <label htmlFor="m-amt">Serving</label>
        <input id="m-amt" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div className="card stack" style={{ gap: 10 }}>
        {rows.map(([k, label, unit]) => (
          <div key={k} className="row between">
            <label htmlFor={`m-${k}`} style={{ fontWeight: 600 }}>{label}</label>
            <div className="row" style={{ gap: 6 }}>
              <input id={`m-${k}`} className="input num" inputMode="decimal" placeholder="0" style={{ width: 100, textAlign: 'right' }} value={n[k]} onChange={e => setN(x => ({ ...x, [k]: e.target.value }))} />
              <span className="muted small" style={{ width: 24 }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>
      <label className="row between" style={{ fontWeight: 600 }}>
        Save for next time
        <input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
      </label>
      <button className="btn block accent" disabled={!name.trim() || !(per.kcal > 0)}>
        Log it
      </button>
    </form>
  );
}
