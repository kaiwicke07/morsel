import { it, expect } from 'vitest';
import { geminiError, modelChain } from './gemini';

it('explains a rejected key', () => {
  expect(geminiError(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } }).message).toMatch(/key was rejected/i);
});
it('passes Google’s own message through for other errors', () => {
  expect(geminiError(403, { error: { status: 'PERMISSION_DENIED', message: 'Generative Language API has not been used in project 123' } }).message).toMatch(/has not been used in project 123/);
});
it('marks quota and missing-model errors as worth trying another model', () => {
  expect(geminiError(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'limit: 0' } }).retryOtherModel).toBe(true);
  expect(geminiError(404, { error: { status: 'NOT_FOUND', message: 'models/x is not found' } }).retryOtherModel).toBe(true);
  expect(geminiError(400, { error: { message: 'API key not valid' } }).retryOtherModel).toBe(false);
});
it('treats "high demand" (503) and server errors as a reason to try the next model', () => {
  expect(geminiError(503, { error: { status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' } }).retryOtherModel).toBe(true);
  expect(geminiError(500, { error: { status: 'INTERNAL', message: 'oops' } }).retryOtherModel).toBe(true);
});
it('does not claim keys start with AIza (Google changed the format)', () => {
  expect(geminiError(400, { error: { message: 'API key not valid' } }).message).not.toMatch(/AIza/);
});
it('uses the reliability order for built-in models, and puts the last model that worked first', () => {
  const chain = modelChain('gemini-flash-latest');
  expect(chain[0]).toBe('gemini-2.5-flash');
  expect(chain).not.toContain('gemini-2.0-flash');
  expect(new Set(chain).size).toBe(chain.length);
  expect(modelChain('gemini-flash-latest', 'gemini-3.5-flash-lite')[0]).toBe('gemini-3.5-flash-lite');
});
it('tries a custom model the user typed before the built-in list', () => {
  expect(modelChain('gemini-9-pro')[0]).toBe('gemini-9-pro');
});
