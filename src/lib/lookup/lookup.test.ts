import { describe, it, expect } from 'vitest';
import { normalizeOff } from './off';
import { normalizeUsda } from './usda';

describe('normalizeOff', () => {
  it('prefers per-serving values and converts sodium g to mg', () => {
    const r = normalizeOff({
      status: 1,
      product: {
        product_name: 'Peanut Butter', brands: 'Jif', serving_size: '2 tbsp (32 g)', nutriscore_grade: 'c',
        nutriments: {
          'energy-kcal_serving': 190, proteins_serving: 7, carbohydrates_serving: 8, fat_serving: 16,
          fiber_serving: 2, sugars_serving: 3, sodium_serving: 0.14,
          'energy-kcal_100g': 594,
        },
      },
    })!;
    expect(r.name).toBe('Peanut Butter');
    expect(r.brand).toBe('Jif');
    expect(r.amount).toBe('2 tbsp (32 g)');
    expect(r.per.kcal).toBe(190);
    expect(r.per.sodium).toBe(140);
    expect(r.healthScore).toBe(5);
  });
  it('falls back to per-100 g', () => {
    const r = normalizeOff({ status: 1, product: { product_name: 'Oats', nutriments: { 'energy-kcal_100g': 379, proteins_100g: 13 } } })!;
    expect(r.amount).toBe('100 g');
    expect(r.per.kcal).toBe(379);
    expect(r.per.fat).toBe(0);
  });
  it('converts kJ when kcal is missing', () => {
    const r = normalizeOff({ status: 1, product: { product_name: 'Juice', nutriments: { energy_100g: 418.4 } } })!;
    expect(r.per.kcal).toBe(100);
  });
  it('returns null when the product is not found', () => {
    expect(normalizeOff({ status: 0 })).toBeNull();
    expect(normalizeOff({ status: 1, product: { nutriments: {} } })).toBeNull();
  });
});

describe('normalizeUsda', () => {
  it('maps nutrient numbers per 100 g', () => {
    const [r] = normalizeUsda({
      foods: [{
        fdcId: 1, description: 'BANANAS, RAW', dataType: 'SR Legacy',
        foodNutrients: [
          { nutrientNumber: '208', value: 89, unitName: 'KCAL' },
          { nutrientNumber: '203', value: 1.09 },
          { nutrientNumber: '205', value: 22.8 },
          { nutrientNumber: '204', value: 0.33 },
          { nutrientNumber: '291', value: 2.6 },
          { nutrientNumber: '269', value: 12.2 },
          { nutrientNumber: '307', value: 1 },
        ],
      }],
    });
    expect(r.name).toBe('Bananas, raw');
    expect(r.amount).toBe('100 g');
    expect(r.per.kcal).toBe(89);
    expect(r.per.carbs).toBeCloseTo(22.8);
    expect(r.per.sodium).toBe(1);
  });
  it('uses the branded serving size when given in grams', () => {
    const [r] = normalizeUsda({
      foods: [{
        fdcId: 2, description: 'GREEK YOGURT', brandOwner: 'Fage', dataType: 'Branded', servingSize: 170, servingSizeUnit: 'g',
        foodNutrients: [{ nutrientNumber: '208', value: 60 }, { nutrientNumber: '203', value: 10 }],
      }],
    });
    expect(r.amount).toBe('170 g');
    expect(r.per.kcal).toBe(102);
    expect(r.per.protein).toBe(17);
    expect(r.brand).toBe('Fage');
  });
  it('lists generic foods before branded ones, keeping relevance order within each', () => {
    const f = (fdcId: number, dataType: string) => ({ fdcId, description: `F${fdcId}`, dataType, servingSize: 30, servingSizeUnit: 'g', foodNutrients: [{ nutrientNumber: '208', value: 100 }] });
    const out = normalizeUsda({ foods: [f(1, 'Branded'), f(2, 'SR Legacy'), f(3, 'Branded'), f(4, 'Survey (FNDDS)')] });
    expect(out.map(x => x.key)).toEqual(['usda:2', 'usda:4', 'usda:1', 'usda:3']);
  });
  it('skips foods without energy', () => {
    expect(normalizeUsda({ foods: [{ fdcId: 3, description: 'WATER', foodNutrients: [] }] })).toEqual([]);
    expect(normalizeUsda({})).toEqual([]);
  });
});
