import type { LookupFood } from './off';

const NUMBERS = { kcal: '208', protein: '203', carbs: '205', fat: '204', fiber: '291', sugar: '269', sodium: '307' } as const;
const IDS = { kcal: 1008, protein: 1003, carbs: 1005, fat: 1004, fiber: 1079, sugar: 2000, sodium: 1093 } as const;

function titleCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function normalizeUsda(json: any): LookupFood[] {
  const foods: any[] = Array.isArray(json?.foods) ? json.foods : [];
  const out: (LookupFood & { branded: boolean })[] = [];
  for (const f of foods) {
    const list: any[] = f.foodNutrients || [];
    const val = (k: keyof typeof NUMBERS): number | undefined => {
      const hit = list.find(n => String(n.nutrientNumber) === NUMBERS[k] || n.nutrientId === IDS[k]);
      return typeof hit?.value === 'number' ? hit.value : undefined;
    };
    const kcal100 = val('kcal');
    if (kcal100 === undefined) continue;

    const branded = f.dataType === 'Branded' && typeof f.servingSize === 'number' && /^(g|grm|gram|grams)$/i.test(f.servingSizeUnit || '');
    const grams = branded ? f.servingSize : 100;
    const k = grams / 100;
    const r1 = (x: number | undefined) => Math.round((x ?? 0) * k * 10) / 10;

    out.push({
      key: `usda:${f.fdcId}`,
      name: titleCase(String(f.description || 'Food')),
      brand: f.brandOwner || f.brandName || undefined,
      amount: `${Math.round(grams)} g`,
      grams,
      per: {
        kcal: Math.round(kcal100 * k),
        protein: r1(val('protein')),
        carbs: r1(val('carbs')),
        fat: r1(val('fat')),
        fiber: r1(val('fiber')),
        sugar: r1(val('sugar')),
        sodium: Math.round((val('sodium') ?? 0) * k),
      },
      healthScore: 5,
      branded: f.dataType === 'Branded',
    });
  }
  // generic foods first; Array.prototype.sort is stable, so relevance order is kept within each group
  return out.sort((a, b) => Number(a.branded) - Number(b.branded)).map(({ branded: _b, ...food }) => food);
}

export async function searchUsda(query: string, apiKey?: string, signal?: AbortSignal): Promise<LookupFood[]> {
  const params = new URLSearchParams({
    api_key: apiKey || 'DEMO_KEY',
    query,
    pageSize: '30',
  });
  params.append('dataType', 'Foundation');
  params.append('dataType', 'SR Legacy');
  params.append('dataType', 'Survey (FNDDS)');
  params.append('dataType', 'Branded');
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`, { signal });
  if (res.status === 429) throw new Error('Food search is rate-limited. Add a free USDA key in Settings.');
  if (!res.ok) throw new Error(`Food search failed (${res.status})`);
  return normalizeUsda(await res.json());
}
