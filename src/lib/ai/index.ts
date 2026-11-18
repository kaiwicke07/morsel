import { getSettings } from '../db';
import { blobToBase64 } from '../image';
import { EXERCISE_SYSTEM, FOOD_SYSTEM, LABEL_SYSTEM, exercisePrompt, fixPrompt, photoPrompt, textPrompt } from './prompts';
import type { Provider } from './provider';
import { EXERCISE_SCHEMA, FOOD_SCHEMA, parseExerciseResult, parseFoodResult, type ExerciseResult, type FoodResult } from './schema';

export class NoKeyError extends Error {
  constructor() {
    super('Add an AI key in Settings to use scanning.');
  }
}

async function provider(): Promise<Provider> {
  const s = await getSettings();
  const ai = s?.ai;
  if (ai?.provider === 'gemini') {
    if (!ai.geminiKey) throw new NoKeyError();
    const { geminiProvider } = await import('./gemini');
    return geminiProvider(ai.geminiKey.trim(), ai.geminiModel || 'gemini-flash-latest');
  }
  if (!ai?.claudeKey) throw new NoKeyError();
  // the SDK is large; load it only when a scan actually happens
  const { claudeProvider } = await import('./claude');
  return claudeProvider(ai.claudeKey.trim(), ai.claudeModel || 'claude-opus-5-5');
}

export async function hasAiKey(): Promise<boolean> {
  const ai = (await getSettings())?.ai;
  return !!(ai && (ai.provider === 'gemini' ? ai.geminiKey : ai.claudeKey));
}

export type AnalyzeInput =
  | { kind: 'photo'; image: Blob; hint?: string }
  | { kind: 'label'; image: Blob }
  | { kind: 'text'; text: string };

export async function analyze(input: AnalyzeInput): Promise<FoodResult> {
  const p = await provider();
  const diet = (await getSettings())?.profile.diet;
  if (input.kind === 'text') {
    return parseFoodResult(await p.json({ system: FOOD_SYSTEM, prompt: textPrompt(input.text, diet), schema: FOOD_SCHEMA, effort: 'low' }));
  }
  const image = await blobToBase64(input.image);
  if (input.kind === 'label') {
    return parseFoodResult(await p.json({ system: LABEL_SYSTEM, prompt: 'Read this nutrition label.', image, schema: FOOD_SCHEMA, effort: 'low' }));
  }
  return parseFoodResult(await p.json({ system: FOOD_SYSTEM, prompt: photoPrompt(input.hint, diet), image, schema: FOOD_SCHEMA, effort: 'medium' }));
}

export async function fix(prev: FoodResult, note: string, image?: Blob): Promise<FoodResult> {
  const p = await provider();
  return parseFoodResult(
    await p.json({
      system: FOOD_SYSTEM,
      prompt: fixPrompt(prev, note),
      image: image ? await blobToBase64(image) : undefined,
      schema: FOOD_SCHEMA,
      effort: 'medium',
    }),
  );
}

export async function describeExercise(text: string, kg: number): Promise<ExerciseResult> {
  const p = await provider();
  return parseExerciseResult(await p.json({ system: EXERCISE_SYSTEM, prompt: exercisePrompt(text, kg), schema: EXERCISE_SCHEMA, effort: 'low' }));
}

export type { FoodResult, ExerciseResult };
