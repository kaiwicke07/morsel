import type { AiRequest, Provider } from './provider';

export function geminiProvider(key: string, model: string): Provider {
  return {
    async json({ system, prompt, image, schema }: AiRequest): Promise<string> {
      const parts: unknown[] = [];
      if (image) parts.push({ inline_data: { mime_type: 'image/jpeg', data: image } });
      parts.push({ text: `${prompt}\n\nReply with only a JSON object matching this JSON Schema:\n${JSON.stringify(schema)}` });

      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
          }),
        });
      } catch {
        throw new Error("Can't reach Gemini. Check your connection.");
      }
      if (res.status === 400 || res.status === 403) {
        const body = await res.text();
        if (/API key/i.test(body)) throw new Error('Your Gemini API key was rejected. Check it in Settings.');
        throw new Error(`Gemini rejected the request (${res.status}).`);
      }
      if (res.status === 404) throw new Error(`Gemini model "${model}" not found. Change it in Settings.`);
      if (res.status === 429) throw new Error('Gemini free-tier limit reached. Wait a minute and retry.');
      if (!res.ok) throw new Error(`Gemini error ${res.status}.`);
      const json = await res.json();
      const text: string = (json?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
      if (!text.trim()) throw new Error('Gemini returned an empty answer. Retry.');
      return text;
    },
  };
}
