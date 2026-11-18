import type { AiRequest, Provider } from './provider';

interface GoogleError { error?: { status?: string; message?: string; details?: { reason?: string }[] } }

/** Turn Google's error into a message a person can act on, and say whether another model might work. */
export function geminiError(status: number, body: GoogleError): { message: string; retryOtherModel: boolean } {
  const e = body?.error ?? {};
  const msg = (e.message || '').trim();
  const badKey = /API key not valid|API_KEY_INVALID/i.test(msg) || (e.details ?? []).some(d => d.reason === 'API_KEY_INVALID');
  if (badKey) return { message: 'Your Gemini API key was rejected. Copy it again from aistudio.google.com/apikey (it starts with "AIza").', retryOtherModel: false };
  if (status === 404) return { message: `Gemini model not found: ${msg}`, retryOtherModel: true };
  if (status === 429) return { message: `Gemini's free tier said no: ${msg.slice(0, 160)}`, retryOtherModel: true };
  return { message: `Gemini error ${status}: ${msg.slice(0, 200) || e.status || 'unknown'}`, retryOtherModel: false };
}

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

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

      const models = [model, ...FALLBACK_MODELS.filter(m => m !== model)];
      let last: Error | null = null;
      for (const m of models) {
        let res: Response;
        try {
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body,
          });
        } catch {
          throw new Error("Can't reach Gemini. Check your connection.");
        }
        const json = await res.json().catch(() => ({}));
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
        return text;
      }
      throw last ?? new Error('Gemini failed.');
    },
  };
}
