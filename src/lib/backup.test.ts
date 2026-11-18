import { it, expect } from 'vitest';
import { stripSecrets, keepLocalSecrets } from './backup';

const row = { id: 'me', usdaKey: 'U', ai: { provider: 'claude', claudeKey: 'sk-ant-x', claudeModel: 'm', geminiKey: 'G', geminiModel: 'g' } } as any;

it('removes API keys from exported settings', () => {
  const out = stripSecrets(row);
  expect(out.ai.claudeKey).toBe('');
  expect(out.ai.geminiKey).toBe('');
  expect(out.usdaKey).toBe('');
  expect(out.ai.claudeModel).toBe('m');
  expect(row.ai.claudeKey).toBe('sk-ant-x'); // original untouched
});

it('keeps the keys already on this device when importing', () => {
  const imported = { ...row, usdaKey: 'evil', ai: { ...row.ai, claudeKey: 'other', geminiKey: '' } };
  const local = { ...row, ai: { ...row.ai, claudeKey: 'mine', geminiKey: 'mineG' }, usdaKey: 'mineU' };
  const merged = keepLocalSecrets(imported, local);
  expect(merged.ai.claudeKey).toBe('mine');
  expect(merged.ai.geminiKey).toBe('mineG');
  expect(merged.usdaKey).toBe('mineU');
});

it('imports with blank keys when this device has none', () => {
  const merged = keepLocalSecrets({ ...row }, undefined);
  expect(merged.ai.claudeKey).toBe('');
  expect(merged.usdaKey).toBe('');
});
