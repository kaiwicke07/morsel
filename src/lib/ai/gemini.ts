import type { AiRequest, Provider } from './provider';

interface GoogleError { error?: { status?: string; message?: string; details?: { reason?: string }[] } }

/** Turn Google's error into a message a person can act on, and say whether another model might work. */
export function geminiError(status: number, body: GoogleError): { message: string; retryOtherModel: boolean } {
  const e = body?.error ?? {};
  const msg = (e.message || '').trim();
  const badKey = /API key not valid|API_KEY_INVALID/i.test(msg) || (e.details ?? []).some(d => d.reason === 'API_KEY_INVALID');
  if (badKey) return { message: 'Your Gemini API key was rejected. Copy it again from aistudio.google.com/apikey.', retryOtherModel: false };
  if (status === 404) return { message: `Gemini model not found: ${msg}`, retryOtherModel: true };
  if (status === 429) return { message: `Gemini's free tier said no: ${msg.slice(0, 160)}`, retryOtherModel: true };
  if (status === 503 || status >= 500) return { message: 'Gemini is busy right now. Try again in a minute.', retryOtherModel: true };
  return { message: `Gemini error ${status}: ${msg.slice(0, 200) || e.status || 'unknown'}`, retryOtherModel: false };
}

/**
 * Vision-capable models that worked on a free key, most reliable first (measured 2026-11-18:
 * the 3.x models were mostly "high demand"). Google retires models, so Morsel walks this list.
 */
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-lite-latest'];

/** Built-in models follow the reliability order; a custom model goes first; the last one that worked goes first of all. */
export function modelChain(chosen: string, lastGood?: string): string[] {
  const base = FALLBACK_MODELS.includes(chosen) ? FALLBACK_MODELS : [chosen, ...FALLBACK_MODELS];
  return [...new Set([lastGood, ...base].filter((m): m is string => !!m))];
}

const LAST_GOOD = 'morsel.gemini.lastGood';
const readLastGood = () => {
  try {
    return localStorage.getItem(LAST_GOOD) ?? undefined;
  } catch {
    return undefined;
  }
};
const saveLastGood = (m: string) => {
  try {
    localStorage.setItem(LAST_GOOD, m);
  } catch {
    /* private mode etc. */
  }
};

/** A busy model can take 20+ seconds to say no; don't wait on any one model longer than this. */
const PER_MODEL_MS = 25_000;

export function geminiProvider(key: string, model: string): Provider {
  return {
    async json({ system, prompt, image, schema }: AiRequest): Promise<string> {
      const parts: unknown[] = [];
      if (image) parts.push({ inline_data: { mime_type: 'image/jpeg', data: image } });
      parts.push({ text: `${prompt}\n\nReply with only a JSON object matching this JSON Schema:\n${JSON.stringify(schema)}` });
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      });

      const models = modelChain(model, readLastGood());
      let last: Error | null = null;
      for (const m of models) {
        let res: Response;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), PER_MODEL_MS);
        try {
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body,
            signal: ctrl.signal,
          });
        } catch (e) {
          clearTimeout(timer);
          if ((e as Error).name === 'AbortError') {
            last = new Error('Gemini is busy right now. Try again in a minute.');
            continue;
          }
          throw new Error("Can't reach Gemini. Check your connection.");
        }
        const json = await res.json().catch(() => ({}));
        clearTimeout(timer);
        if (!res.ok) {
          const err = geminiError(res.status, json);
          last = new Error(err.message);
          if (err.retryOtherModel) continue;
          throw last;
        }
        const text: string = (json?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
        if (!text.trim()) {
          const reason = json?.promptFeedback?.blockReason || json?.candidates?.[0]?.finishReason;
          throw new Error(reason ? `Gemini returned nothing (${reason}). Retry.` : 'Gemini returned an empty answer. Retry.');
        }
        saveLastGood(m);
        return text;
      }
      throw last ?? new Error('Gemini failed.');
    },
  };
}
