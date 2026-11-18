import { it, expect } from 'vitest';
import { geminiError } from './gemini';

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
