import Anthropic from '@anthropic-ai/sdk';
import type { AiRequest, Provider } from './provider';

function client(key: string) {
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90_000 });
}

function friendly(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error('Your Claude API key was rejected. Check it in Settings.');
  if (e instanceof Anthropic.PermissionDeniedError) return new Error("This Claude key isn't allowed to use that model. Try another model in Settings.");
  if (e instanceof Anthropic.RateLimitError) return new Error('Claude is rate-limiting this key. Wait a minute and retry.');
  if (e instanceof Anthropic.BadRequestError) {
    const msg = e.message || '';
    if (/credit balance/i.test(msg)) return new Error('Your Claude account is out of credits.');
    return new Error(`Claude rejected the request: ${msg}`);
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new Error('Claude took too long. Retry.');
  if (e instanceof Anthropic.APIConnectionError) return new Error("Can't reach Claude. Check your connection.");
  if (e instanceof Anthropic.APIError) return new Error(`Claude error ${e.status ?? ''}: ${e.message}`);
  return e instanceof Error ? e : new Error(String(e));
}

export function claudeProvider(key: string, model: string): Provider {
  return {
    async json({ system, prompt, image, schema, effort }: AiRequest): Promise<string> {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
      content.push({ type: 'text', text: prompt });

      // Server-side fallback reruns a declined request on another model; Haiku has none.
      const fallback = /haiku/i.test(model) ? {} : { betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[], fallbacks: 'default' as const };

      let res: Anthropic.Beta.BetaMessage;
      try {
        res = await client(key).beta.messages.create({
          model,
          max_tokens: 16000,
          system,
          messages: [{ role: 'user', content }],
          output_config: { effort, format: { type: 'json_schema', schema } },
          ...fallback,
        });
      } catch (e) {
        throw friendly(e);
      }
      if (res.stop_reason === 'refusal') throw new Error("Claude declined to analyze this one. Try a different photo or describe it.");
      if (res.stop_reason === 'max_tokens') throw new Error('The answer was cut off. Retry.');
      const text = res.content.map(b => (b.type === 'text' ? b.text : '')).join('');
      if (!text.trim()) throw new Error('Claude returned an empty answer. Retry.');
      return text;
    },
  };
}
