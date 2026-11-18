import type { Ingredient, Nutrients } from '../types';

export interface FoodResult {
  name: string;
  per: Nutrients;
  ingredients: Ingredient[];
  healthScore: number;
  healthNote: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface ExerciseResult {
  label: string;
  minutes: number;
  kcal: number;
}

const NUM_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const;

const itemSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Ingredient name, e.g. "Grilled chicken breast"' },
    amount: { type: 'string', description: 'Estimated amount, e.g. "4 oz" or "1 cup"' },
    kcal: { type: 'number' },
    protein: { type: 'number', description: 'grams' },
    carbs: { type: 'number', description: 'grams' },
    fat: { type: 'number', description: 'grams' },
    fiber: { type: 'number', description: 'grams' },
    sugar: { type: 'number', description: 'grams' },
    sodium: { type: 'number', description: 'milligrams' },
  },
  required: ['name', 'amount', ...NUM_KEYS],
  additionalProperties: false,
};

/** JSON schema for structured output (Claude) and prompt guidance (Gemini). */
export const FOOD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Short, natural meal name, e.g. "Chicken burrito bowl"' },
    not_food: { type: 'boolean', description: 'true only if there is no food or drink to analyze' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    health_score: { type: 'integer', description: '1 (very unhealthy) to 10 (very healthy)' },
    health_note: { type: 'string', description: 'One short sentence on why it got that score' },
    items: { type: 'array', items: itemSchema },
  },
  required: ['name', 'not_food', 'confidence', 'health_score', 'health_note', 'items'],
  additionalProperties: false,
} as const;

export const EXERCISE_SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string', description: 'Short name of the activity, e.g. "Yoga"' },
    minutes: { type: 'number' },
    kcal: { type: 'number', description: 'Estimated calories burned' },
  },
  required: ['label', 'minutes', 'kcal'],
  additionalProperties: false,
} as const;

function toObject(x: unknown): Record<string, unknown> {
  if (typeof x === 'string') {
    const s = x.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error("Couldn't read the AI's answer.");
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      throw new Error("Couldn't read the AI's answer.");
    }
  }
  if (x && typeof x === 'object') return x as Record<string, unknown>;
  throw new Error("Couldn't read the AI's answer.");
}

function num(v: unknown, field: string): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new Error(`Bad value for ${field}`);
  return n;
}

export function parseFoodResult(x: unknown): FoodResult {
  const o = toObject(x);
  if (o.not_food === true) throw new Error("That doesn't look like food. Try another photo.");
  if (typeof o.name !== 'string' || !Array.isArray(o.items) || o.items.length === 0) {
    throw new Error("Couldn't read the AI's answer.");
  }
  const ingredients: Ingredient[] = o.items.map((raw, i) => {
    const it = toObject(raw);
    if (typeof it.name !== 'string') throw new Error(`Bad ingredient ${i + 1}`);
    const ing: Ingredient = {
      name: it.name,
      amount: typeof it.amount === 'string' ? it.amount : '',
      kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0,
    };
    for (const k of NUM_KEYS) ing[k] = num(it[k], `${it.name} ${k}`);
    return ing;
  });
  const per: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  for (const ing of ingredients) for (const k of NUM_KEYS) per[k] += ing[k];
  for (const k of NUM_KEYS) per[k] = Math.round(per[k] * 10) / 10;
  per.kcal = Math.round(per.kcal);

  const hs = Math.round(num(o.health_score ?? 5, 'health score'));
  const conf = o.confidence === 'low' || o.confidence === 'high' ? o.confidence : 'medium';
  return {
    name: o.name.trim() || 'Meal',
    per,
    ingredients,
    healthScore: Math.min(10, Math.max(1, hs)),
    healthNote: typeof o.health_note === 'string' ? o.health_note : '',
    confidence: conf,
  };
}

export function parseExerciseResult(x: unknown): ExerciseResult {
  const o = toObject(x);
  if (typeof o.label !== 'string') throw new Error("Couldn't read the AI's answer.");
  return { label: o.label, minutes: Math.round(num(o.minutes ?? 0, 'minutes')), kcal: Math.round(num(o.kcal, 'kcal')) };
}
