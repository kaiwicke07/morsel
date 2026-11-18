import { useState } from 'react';
import { useSettings } from '../data';
import { analyze } from '../lib/ai';
import { patchSettings, type Settings } from '../lib/db';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { Screen, SegTabs } from '../ui/primitives';

const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', note: 'Most accurate · about 1¢ a photo' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', note: 'Nearly as good · about half the cost' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', note: 'Fastest and cheapest · rougher portions' },
];

export function AiSettings() {
  const nav = useNav();
  const s = useSettings();
  if (!s) return null;
  return <Inner s={s} onClose={nav.pop} />;
}

function Inner({ s, onClose }: { s: Settings; onClose: () => void }) {
  const [ai, setAi] = useState(s.ai);
  const [usda, setUsda] = useState(s.usdaKey);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' });
  const save = (next = ai) => patchSettings({ ai: next, usdaKey: usda.trim() });
  const key = ai.provider === 'claude' ? ai.claudeKey : ai.geminiKey;

  return (
    <Screen title="Photo scanning" onClose={() => { void save(); onClose(); }}>
      {close => (
        <div className="page stack" style={{ gap: 16, paddingBottom: 30 }}>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Scanning sends the photo straight from your phone to the AI you pick. Your key is stored only on this phone and is never included in backups.
          </p>
          <SegTabs
            value={ai.provider}
            onChange={v => { setAi({ ...ai, provider: v }); setTest({ state: 'idle' }); }}
            options={[
              { value: 'claude', label: 'Claude' },
              { value: 'gemini', label: 'Gemini (free)' },
            ]}
          />

          <div className="field">
            <label htmlFor="ai-key">{ai.provider === 'claude' ? 'Claude API key' : 'Gemini API key'}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="ai-key"
                className="input"
                type={show ? 'text' : 'password'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                placeholder={ai.provider === 'claude' ? 'sk-ant-…' : 'AIza…'}
                value={key}
                onChange={e => setAi(ai.provider === 'claude' ? { ...ai, claudeKey: e.target.value.trim() } : { ...ai, geminiKey: e.target.value.trim() })}
                style={{ paddingRight: 64 }}
              />
              <button type="button" className="small" style={{ position: 'absolute', right: 12, top: 15, fontWeight: 600, color: 'var(--accent)' }} onClick={() => setShow(!show)}>
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="small muted">
              {ai.provider === 'claude' ? (
                <>Get one at <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>platform.claude.com → API keys</a>. Billed per use to that account.</>
              ) : (
                <>Get a free one at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>aistudio.google.com/apikey</a>. Free tier has daily limits.</>
              )}
            </span>
          </div>

          {ai.provider === 'claude' ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="tiny faint">Model</div>
              {CLAUDE_MODELS.map(m => (
                <button key={m.id} className="option" aria-pressed={ai.claudeModel === m.id} onClick={() => setAi({ ...ai, claudeModel: m.id })} style={{ padding: 14 }}>
                  <span>
                    {m.label}
                    <span className="sub">{m.note}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="field">
              <label htmlFor="gm">Gemini model</label>
              <input id="gm" className="input" autoCapitalize="none" autoCorrect="off" value={ai.geminiModel} onChange={e => setAi({ ...ai, geminiModel: e.target.value.trim() })} />
            </div>
          )}

          <button
            className="btn ghost block"
            disabled={!key || test.state === 'busy'}
            onClick={async () => {
              await save();
              setTest({ state: 'busy' });
              try {
                const r = await analyze({ kind: 'text', text: 'one medium banana' });
                setTest({ state: 'ok', msg: `Works. "${r.name}" came back as ${r.per.kcal} cal.` });
              } catch (e) {
                setTest({ state: 'fail', msg: e instanceof Error ? e.message : String(e) });
              }
            }}
          >
            {test.state === 'busy' ? <span className="spinner" /> : <Icon name="spark" size={18} />} Test the key
          </button>
          {test.msg && <p className="small" style={{ margin: 0, color: test.state === 'ok' ? 'var(--good)' : 'var(--bad)' }}>{test.msg}</p>}

          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="usda">USDA food search key (optional)</label>
            <input id="usda" className="input" autoCapitalize="none" autoCorrect="off" placeholder="Uses the shared demo key if empty" value={usda} onChange={e => setUsda(e.target.value.trim())} />
            <span className="small muted">
              The demo key allows about 30 searches an hour. A free personal key from{' '}
              <a href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>fdc.nal.usda.gov</a> removes that.
            </span>
          </div>

          <button className="btn block" onClick={async () => { await save(); close(); }}>
            Save
          </button>
        </div>
      )}
    </Screen>
  );
}
