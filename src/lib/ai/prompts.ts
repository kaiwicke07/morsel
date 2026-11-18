import type { Diet } from '../types';
import type { FoodResult } from './schema';

export const FOOD_SYSTEM = `You are the nutrition engine inside a calorie-tracking app. You estimate what is in a meal and return structured nutrition data.

How to estimate:
- Identify every distinct food and drink. Split mixed dishes into their main components (e.g. a burrito bowl becomes rice, chicken, beans, salsa, cheese, sour cream).
- Estimate portion sizes from visual cues: plate and bowl size (a dinner plate is about 10-11 in), utensils, hands, packaging, cup sizes, thickness. Give each amount in everyday US units (oz, cups, tbsp, pieces) with grams where helpful.
- Always account for hidden calories you can reasonably infer: cooking oil or butter on fried, sauteed or roasted food; dressings; sauces; sugar in drinks. List them as their own items.
- Use standard USDA reference values. Be realistic, not optimistic: restaurant portions are large and restaurant cooking uses more fat.
- Numbers are for the whole portion shown, as one serving. Sodium in milligrams; everything else in grams except kcal.
- Health score 1-10: 9-10 whole, minimally processed, high fiber/protein, low added sugar; 5-6 mixed; 1-3 ultra-processed, fried, sugary or very high sodium. health_note is one short, plain sentence.
- confidence: high when items and portions are clear, low when the photo is unclear or the portion is hidden.
- If there is clearly no food or drink at all, set not_food to true and return an empty items list.
- name: a short natural name a person would use ("Pepperoni pizza, 2 slices"), no brand claims you can't see.`;

export const LABEL_SYSTEM = `You read Nutrition Facts labels inside a calorie-tracking app.
- Transcribe the values for ONE serving exactly as printed. Do not estimate when a value is printed.
- Return a single item whose name is the product (or "Packaged food" if unknown) and whose amount is the printed serving size.
- Convert sodium to milligrams. If fiber or sugar are not printed, use 0.
- Health score 1-10 from the label: reward fiber and protein, penalise added sugar, saturated fat and sodium.
- If the image is not a nutrition label or packaged food, set not_food to true.`;

export function dietLine(diet?: Diet) {
  return diet && diet !== 'classic' ? `The user follows a ${diet} diet; if something looks like meat but they are ${diet}, prefer the plant-based or fish interpretation.` : '';
}

export function photoPrompt(hint?: string, diet?: Diet) {
  return [
    'Analyze this meal photo and return its nutrition.',
    hint ? `The user adds: "${hint}"` : '',
    dietLine(diet),
  ].filter(Boolean).join('\n');
}

export function textPrompt(text: string, diet?: Diet) {
  return [`The user describes what they ate: "${text}". Estimate its nutrition. Assume typical US portions when no size is given.`, dietLine(diet)]
    .filter(Boolean).join('\n');
}

export function fixPrompt(prev: FoodResult, note: string) {
  const items = prev.ingredients.map(i => `- ${i.name} (${i.amount}): ${Math.round(i.kcal)} kcal, P${i.protein} C${i.carbs} F${i.fat}`).join('\n');
  return `Your previous analysis of this meal was "${prev.name}":
${items}

The user says this needs fixing: "${note}"

Apply their correction, keep everything they didn't contradict, and return the full corrected analysis.`;
}

export const EXERCISE_SYSTEM = `You estimate calories burned for a fitness tracker. Use the Compendium of Physical Activities MET values: kcal = MET x body weight in kg x hours. If no duration is given, assume a typical session. Be realistic, not generous.`;

export const exercisePrompt = (text: string, kg: number) =>
  `Body weight: ${kg.toFixed(1)} kg. Activity: "${text}". Return a short label, the duration in minutes, and kcal burned.`;
