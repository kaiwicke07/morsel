export type Sex = 'male' | 'female' | 'other';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Activity = 'low' | 'mid' | 'high'; // 0-2, 3-5, 6+ workouts/week
export type Diet = 'classic' | 'pescatarian' | 'vegetarian' | 'vegan';

export interface Profile {
  sex: Sex;
  birthday: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  goal: Goal;
  activity: Activity;
  paceLbPerWeek: number; // 0.2 - 3.0
  diet: Diet;
  units: 'imperial' | 'metric';
  addBurned: boolean;
  rollover: boolean;
  stepGoal?: number;
  name?: string;
}

export interface Nutrients {
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber: number; // g
  sugar: number; // g
  sodium: number; // mg
}

export interface Targets extends Nutrients {
  water: number; // ml
}

export interface Ingredient extends Nutrients {
  name: string;
  amount: string; // e.g. "1 cup", "120 g"
}

export type EntrySource = 'photo' | 'label' | 'text' | 'barcode' | 'search' | 'manual' | 'saved';

export interface FoodEntry {
  id?: number;
  date: string; // YYYY-MM-DD local
  createdAt: number;
  name: string;
  source: EntrySource;
  status: 'analyzing' | 'ready' | 'error';
  error?: string;
  servings: number;
  /** nutrients for ONE serving */
  per: Nutrients;
  ingredients: Ingredient[];
  healthScore: number; // 1-10
  photoId?: number;
  note?: string;
}

export interface ExerciseEntry {
  id?: number;
  date: string;
  createdAt: number;
  kind: 'run' | 'lift' | 'describe' | 'manual';
  label: string;
  intensity?: 1 | 2 | 3;
  minutes?: number;
  kcal: number;
}
