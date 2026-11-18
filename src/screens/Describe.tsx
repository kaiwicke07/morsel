import { useEffect, useState } from 'react';
import { logText } from '../data';
import { hasAiKey } from '../lib/ai';
import { useNav } from '../nav';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/primitives';

export function Describe() {
  const nav = useNav();
  const [text, setText] = useState('');
  const [keyOk, setKeyOk] = useState(true);
  useEffect(() => {
    void hasAiKey().then(setKeyOk);
  }, []);
  const examples = ['Two scrambled eggs, a slice of sourdough with butter, black coffee', 'Chipotle chicken bowl with white rice, black beans, cheese and guac', 'A large iced oat milk latte and a blueberry muffin'];
  return (
    <Screen title="Describe a meal" onClose={nav.pop}>
      {close => (
        <form
          className="page stack"
          onSubmit={async e => {
            e.preventDefault();
            if (!text.trim()) return;
            await logText(nav.date, text.trim());
            close();
            nav.showToast('Estimating…');
          }}
        >
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: '8px 0 0', lineHeight: 1.1 }}>What did you eat?</h1>
          <p className="muted small" style={{ margin: 0 }}>Include amounts if you know them. Tap the mic on the keyboard to talk instead of typing.</p>
          <textarea className="input" autoFocus rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. a turkey sandwich on wheat with mustard and a bag of chips" enterKeyHint="send" />
          <div className="stack" style={{ gap: 8 }}>
            {examples.map(x => (
              <button type="button" key={x} className="chip" style={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 44, borderRadius: 12 }} onClick={() => setText(x)}>
                {x}
              </button>
            ))}
          </div>
          {!keyOk && (
            <button type="button" className="card small" style={{ textAlign: 'left', border: '1.5px dashed var(--accent)', boxShadow: 'none', background: 'transparent' }} onClick={() => nav.replace({ kind: 'ai' })}>
              This needs an AI key. Tap to add one.
            </button>
          )}
          <button className="btn block accent" disabled={!text.trim() || !keyOk}>
            <Icon name="spark" size={20} /> Estimate
          </button>
        </form>
      )}
    </Screen>
  );
}
