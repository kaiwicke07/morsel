import type { Nutrients } from '../types';

export interface LookupFood {
  key: string;
  name: string;
  brand?: string;
  amount: string;
  per: Nutrients;
  healthScore: number;
  /** grams in one serving, when known (lets the user switch to grams) */
  grams?: number;
}

const GRADE_SCORE: Record<string, number> = { a: 9, b: 7, c: 5, d: 3, e: 2 };

type Nutriments = Record<string, number | string | undefined>;

function pick(n: Nutriments, key: string, suffix: '_serving' | '_100g'): number | undefined {
  const v = n[key + suffix];
  const x = typeof v === 'string' ? Number(v) : v;
  return typeof x === 'number' && Number.isFinite(x) ? x : undefined;
}

function energy(n: Nutriments, suffix: '_serving' | '_100g'): number | undefined {
  const kcal = pick(n, 'energy-kcal', suffix);
  if (kcal !== undefined) return kcal;
  const kj = pick(n, 'energy', suffix);
  return kj !== undefined ? kj / 4.184 : undefined;
}

export function normalizeOff(json: any): LookupFood | null {
  if (!json || json.status !== 1 || !json.product) return null;
  const p = json.product;
  const name: string = (p.product_name || p.generic_name || '').trim();
  const n: Nutriments = p.nutriments || {};
  if (!name) return null;

  let suffix: '_serving' | '_100g' = '_serving';
  let amount: string = p.serving_size || '1 serving';
  if (energy(n, '_serving') === undefined) {
    suffix = '_100g';
    amount = '100 g';
  }
  const kcal = energy(n, suffix);
  if (kcal === undefined) return null;

  const g = (k: string) => Math.round((pick(n, k, suffix) ?? 0) * 10) / 10;
  const sodiumG = pick(n, 'sodium', suffix) ?? (pick(n, 'salt', suffix) ?? 0) / 2.5;
  const grams = suffix === '_100g' ? 100 : Number(p.serving_quantity) || undefined;

  return {
    key: `off:${p.code || p._id || name}`,
    name,
    brand: p.brands ? String(p.brands).split(',')[0].trim() : undefined,
    amount,
    per: {
      kcal: Math.round(kcal),
      protein: g('proteins'),
      carbs: g('carbohydrates'),
      fat: g('fat'),
      fiber: g('fiber'),
      sugar: g('sugars'),
      sodium: Math.round(sodiumG * 1000),
    },
    healthScore: GRADE_SCORE[String(p.nutriscore_grade || '').toLowerCase()] ?? 5,
    grams,
  };
}

const FIELDS = 'code,product_name,generic_name,brands,nutriments,serving_size,serving_quantity,nutriscore_grade';

export async function lookupBarcode(code: string): Promise<LookupFood | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Barcode lookup failed (${res.status})`);
  return normalizeOff(await res.json());
}
