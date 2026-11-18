import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { applyFix, deleteEntry, logLookup, restoreEntry, runAnalysis, toggleSaved, usePhoto } from '../data';
import { db } from '../lib/db';
import { NUTRIENT_KEYS, entryTotals, manualNutritionPatch, scaleNutrients } from '../lib/day';
import type { LookupFood } from '../lib/lookup/off';
import type { FoodEntry, Ingredient, Nutrients } from '../lib/types';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { PlateGlyph, Screen, SegTabs, Sheet, Stepper } from '../ui/primitives';
import { ScoreBar } from './Home';

const r = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

function NutritionBlock({ n, servingsLabel }: { n: Nutrients; servingsLabel?: string }) {
  const tiles = [
    { k: 'Protein', v: n.protein, c: 'var(--protein)' },
    { k: 'Carbs', v: n.carbs, c: 'var(--carbs)' },
    { k: 'Fat', v: n.fat, c: 'var(--fat)' },
  ];
  return (
    <>
      <div className="card" style={{ padding: 18 }}>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="tiny faint">Calories</div>
            <div className="num" style={{ fontSize: 50, fontWeight: 600, lineHeight: 1 }}>{r(n.kcal).toLocaleString()}</div>
          </div>
          {servingsLabel && <span className="small muted">{servingsLabel}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 }}>
          {tiles.map(t => (
            <div key={t.k} style={{ background: 'var(--card-2)', borderRadius: 12, padding: '10px 12px' }}>
              <div className="small muted row" style={{ gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: t.c }} />
                {t.k}
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{r1(t.v)}g</div>
            </div>
          ))}
        </div>
        <div className="row between small muted" style={{ marginTop: 12 }}>
          <span>Fiber <b className="num" style={{ color: 'var(--ink)' }}>{r1(n.fiber)}g</b></span>
          <span>Sugar <b className="num" style={{ color: 'var(--ink)' }}>{r1(n.sugar)}g</b></span>
          <span>Sodium <b className="num" style={{ color: 'var(--ink)' }}>{r(n.sodium)}mg</b></span>
        </div>
      </div>
    </>
  );
}

export function FoodDetail({ id }: { id: number }) {
  const nav = useNav();
  const e = useLiveQuery(() => db.entries.get(id), [id]);
  const photo = usePhoto(e?.photoId, 'full');
  const saved = useLiveQuery(async () => (e ? !!(await db.saved.where('name').equals(e.name).first()) : false), [e?.name]);
  const [fixing, setFixing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rename, setRename] = useState<string | null>(null);

  if (e === undefined) return null;
  if (!e) return null;
  const totals = entryTotals(e);
  const busy = e.status === 'analyzing';

  const update = (patch: Partial<FoodEntry>) => db.entries.update(id, patch);
  const removeIngredient = (i: number) => {
    const ingredients = e.ingredients.filter((_, j) => j !== i);
    const per = { ...e.per };
    for (const k of NUTRIENT_KEYS) per[k] = Math.max(0, r1(per[k] - e.ingredients[i][k]));
    void update({ ingredients, per });
  };

  return (
    <Screen
      title=""
      onClose={nav.pop}
      right={close => (
        <button
          className="icon-btn"
          aria-label="Delete entry"
          onClick={async () => {
            const gone = await deleteEntry(id);
            close();
            if (gone) nav.showToast(`Removed ${gone.name}`, { label: 'Undo', run: () => void restoreEntry(gone) });
          }}
        >
          <Icon name="trash" size={20} />
        </button>
      )}
    >
      {close => (
        <div className="page" style={{ paddingBottom: 110 }}>
          <div style={{ borderRadius: 22, overflow: 'hidden', background: 'var(--card-2)', aspectRatio: photo ? '4 / 3' : '3 / 1', display: 'grid', placeItems: 'center', marginTop: 4 }}>
            {photo ? <img src={photo} alt={e.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PlateGlyph size={54} />}
          </div>

          <div className="row between" style={{ marginTop: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small faint">
                {new Date(e.createdAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                {e.confidence === 'low' && ' · rough estimate'}
              </div>
              {rename !== null ? (
                <form onSubmit={ev => { ev.preventDefault(); if (rename.trim()) void update({ name: rename.trim() }); setRename(null); }}>
                  <input className="input serif" autoFocus value={rename} onChange={ev => setRename(ev.target.value)} onBlur={() => { if (rename.trim()) void update({ name: rename.trim() }); setRename(null); }} style={{ fontSize: 22, fontWeight: 600 }} enterKeyHint="done" />
                </form>
              ) : (
                <button className="serif" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1, textAlign: 'left' }} onClick={() => setRename(e.name)}>
                  {busy ? 'Updating…' : e.name}
                  <Icon name="pencil" size={16} className="faint" />
                </button>
              )}
            </div>
            <button
              className="icon-btn"
              aria-label={saved ? 'Remove from saved' : 'Save food'}
              aria-pressed={!!saved}
              style={{ color: saved ? 'var(--accent)' : undefined }}
              onClick={async () => nav.showToast((await toggleSaved(e)) ? 'Saved to your foods' : 'Removed from saved')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M7 4h10v16l-5-3.5L7 20z" /></svg>
            </button>
          </div>

          {e.status === 'error' && !busy && (
            <div className="card row" style={{ marginTop: 12, background: 'var(--accent-soft)', boxShadow: 'none' }}>
              <span style={{ flex: 1 }} className="small">{e.error}</span>
              {/AI key/.test(e.error || '') ? (
                <button className="btn sm" onClick={() => nav.push({ kind: 'ai' })}>Add key</button>
              ) : (
                e.per.kcal === 0 && <button className="btn sm" onClick={() => runAnalysis(id)}>Retry</button>
              )}
            </div>
          )}
          {e.status === 'ready' && e.error && (
            <div className="small" style={{ color: 'var(--bad)', marginTop: 8 }}>Fix failed: {e.error}</div>
          )}

          <div className="row between" style={{ margin: '18px 0 12px' }}>
            <span style={{ fontWeight: 600 }}>Servings</span>
            <Stepper value={e.servings} onChange={v => update({ servings: v })} />
          </div>

          <div style={{ opacity: busy ? 0.4 : 1, transition: 'opacity 200ms' }}>
            <NutritionBlock n={totals} />

            <div className="card" style={{ marginTop: 12 }}>
              <div className="row between">
                <span style={{ fontWeight: 600 }}>Health score</span>
                <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>{e.healthScore}<span className="muted small">/10</span></span>
              </div>
              <ScoreBar v={e.healthScore} />
              {e.healthNote && <p className="small muted" style={{ margin: '8px 0 0' }}>{e.healthNote}</p>}
            </div>

            <h3 className="section-title" style={{ fontSize: 19, marginTop: 22 }}>What's in it</h3>
            <div className="card" style={{ padding: 4 }}>
              {e.ingredients.map((ing, i) => (
                <IngredientRow key={i} ing={ing} k={e.servings} onRemove={e.ingredients.length > 1 ? () => removeIngredient(i) : undefined} first={i === 0} />
              ))}
              {!e.ingredients.length && <div className="small muted" style={{ padding: 14 }}>No breakdown for this one.</div>}
            </div>
            <button className="btn sm ghost" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>
              <Icon name="pencil" size={16} /> Edit numbers
            </button>
          </div>

          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(var(--safe-bottom) + 12px)', background: 'linear-gradient(transparent, var(--paper) 30%)' }}>
            <div className="row" style={{ maxWidth: 560, margin: '0 auto', gap: 10 }}>
              <button className="btn ghost" style={{ flex: 1 }} disabled={busy} onClick={() => setFixing(true)}>
                <Icon name="spark" size={20} /> Fix result
              </button>
              <button className="btn" style={{ flex: 1 }} onClick={close}>
                Done
              </button>
            </div>
          </div>

          {fixing && <FixSheet entry={e} onClose={() => setFixing(false)} />}
          {editing && <EditSheet entry={e} onClose={() => setEditing(false)} />}
        </div>
      )}
    </Screen>
  );
}

function IngredientRow({ ing, k, onRemove, first }: { ing: Ingredient; k: number; onRemove?: () => void; first: boolean }) {
  return (
    <div className="row" style={{ padding: '12px', borderTop: first ? 'none' : '1px solid var(--line)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{ing.name}</div>
        <div className="small muted">
          {ing.amount}
          {k !== 1 && ` × ${k}`} · P{r(ing.protein * k)} C{r(ing.carbs * k)} F{r(ing.fat * k)}
        </div>
      </div>
      <span className="num" style={{ fontWeight: 600 }}>{r(ing.kcal * k)}</span>
      {onRemove && (
        <button className="icon-btn flat" style={{ width: 32, height: 32 }} aria-label={`Remove ${ing.name}`} onClick={onRemove}>
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

function FixSheet({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const nav = useNav();
  const [note, setNote] = useState('');
  const quick = ['Smaller portion', 'Bigger portion', 'Cooked without oil', 'Add a drink', 'It was homemade', 'Dressing on the side'];
  return (
    <Sheet onClose={onClose} label="Fix result">
      {close => (
        <form
          className="stack"
          onSubmit={ev => {
            ev.preventDefault();
            if (!note.trim()) return;
            close();
            applyFix(entry.id!, note.trim())
              .then(() => nav.showToast('Updated'))
              .catch(err => nav.showToast(err instanceof Error ? err.message : 'Fix failed'));
          }}
        >
          <h2 className="serif" style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>What's off?</h2>
          <p className="muted small" style={{ margin: 0 }}>Say it like you'd tell a friend. "It was 2 eggs, not 3." "Add a tablespoon of olive oil."</p>
          <textarea className="input" autoFocus value={note} onChange={ev => setNote(ev.target.value)} placeholder="e.g. the rice was brown rice and about half a cup" enterKeyHint="send" />
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {quick.map(q => (
              <button type="button" key={q} className="chip" onClick={() => setNote(n => (n ? `${n}. ${q}` : q))}>
                {q}
              </button>
            ))}
          </div>
          <button className="btn block accent" disabled={!note.trim()}>
            <Icon name="spark" size={20} /> Update
          </button>
        </form>
      )}
    </Sheet>
  );
}

function EditSheet({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const [vals, setVals] = useState<Record<keyof Nutrients, string>>(() => Object.fromEntries(NUTRIENT_KEYS.map(k => [k, String(entry.per[k])])) as Record<keyof Nutrients, string>);
  const rows: [keyof Nutrients, string, string][] = [
    ['kcal', 'Calories', 'cal'],
    ['protein', 'Protein', 'g'],
    ['carbs', 'Carbs', 'g'],
    ['fat', 'Fat', 'g'],
    ['fiber', 'Fiber', 'g'],
    ['sugar', 'Sugar', 'g'],
    ['sodium', 'Sodium', 'mg'],
  ];
  return (
    <Sheet onClose={onClose} label="Edit nutrition">
      {close => (
        <form
          className="stack"
          onSubmit={async ev => {
            ev.preventDefault();
            const per = Object.fromEntries(NUTRIENT_KEYS.map(k => [k, Math.max(0, Number(vals[k].replace(',', '.')) || 0)])) as unknown as Nutrients;
            await db.entries.update(entry.id!, manualNutritionPatch(entry, per));
            close();
          }}
        >
          <h2 className="serif" style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Per serving</h2>
          {rows.map(([k, label, unit]) => (
            <div key={k} className="row between">
              <label htmlFor={`n-${k}`} style={{ fontWeight: 600 }}>{label}</label>
              <div className="row" style={{ gap: 6 }}>
                <input
                  id={`n-${k}`}
                  className="input num"
                  inputMode="decimal"
                  style={{ width: 110, textAlign: 'right' }}
                  value={vals[k]}
                  onChange={ev => setVals(v => ({ ...v, [k]: ev.target.value.replace(/[^\d.,]/g, '') }))}
                />
                <span className="muted small" style={{ width: 24 }}>{unit}</span>
              </div>
            </div>
          ))}
          <button className="btn block">Save</button>
        </form>
      )}
    </Sheet>
  );
}

export function LookupDetail({ food, source }: { food: LookupFood; source: 'barcode' | 'search' | 'manual' }) {
  const nav = useNav();
  const [mode, setMode] = useState<'servings' | 'grams'>('servings');
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState(String(food.grams ? Math.round(food.grams) : 100));
  const [busy, setBusy] = useState(false);
  const k = mode === 'grams' && food.grams ? (Number(grams) || 0) / food.grams : servings;
  const n = scaleNutrients(food.per, k);

  return (
    <Screen title={source === 'barcode' ? 'Scanned' : 'Add food'} onClose={nav.pop}>
      {close => (
        <div className="page" style={{ paddingBottom: 110 }}>
          {food.brand && <div className="small muted" style={{ marginTop: 6 }}>{food.brand}</div>}
          <h1 className="serif" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1, margin: '2px 0 4px' }}>{food.name}</h1>
          <div className="small muted">1 serving = {food.amount}</div>

          {food.grams ? (
            <div style={{ margin: '18px 0 12px' }}>
              <SegTabs value={mode} onChange={setMode} options={[{ value: 'servings', label: 'Servings' }, { value: 'grams', label: 'Grams' }]} />
            </div>
          ) : (
            <div style={{ height: 18 }} />
          )}
          <div className="row between" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600 }}>{mode === 'grams' ? 'Amount' : 'Servings'}</span>
            {mode === 'grams' ? (
              <div className="row" style={{ gap: 6 }}>
                <input className="input num" inputMode="decimal" style={{ width: 110, textAlign: 'right' }} value={grams} onChange={e => setGrams(e.target.value.replace(/[^\d.]/g, ''))} />
                <span className="muted">g</span>
              </div>
            ) : (
              <Stepper value={servings} onChange={setServings} />
            )}
          </div>
          <NutritionBlock n={n} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(var(--safe-bottom) + 12px)', background: 'linear-gradient(transparent, var(--paper) 30%)' }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <button
                className="btn block accent"
                disabled={!(k > 0) || busy}
                onClick={async () => {
                  setBusy(true);
                  await logLookup(nav.date, food, +k.toFixed(3), source);
                  close();
                  nav.showToast(`Logged ${food.name}`);
                }}
              >
                Log it
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
