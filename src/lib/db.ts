import Dexie, { type Table } from 'dexie';
import type { ExerciseEntry, FoodEntry, Nutrients, Profile, Targets } from './types';

export interface Settings {
  id: 'me';
  onboarded: boolean;
  profile: Profile;
  /** null = use computed plan */
  customTargets: Targets | null;
  ai: {
    provider: 'claude' | 'gemini';
    claudeKey: string;
    claudeModel: string;
    geminiKey: string;
    geminiModel: string;
  };
  usdaKey: string;
  theme: 'system' | 'light' | 'dark';
  seenCameraTips: boolean;
  celebrateBadges: boolean;
  createdAt: number;
  lastBackupAt?: number;
}

export interface WaterEntry { id?: number; date: string; createdAt: number; ml: number }
export interface WeightEntry { id?: number; date: string; createdAt: number; kg: number }
export interface PhotoRow { id?: number; full: Blob; thumb: Blob; createdAt: number }
export interface SavedFood {
  id?: number;
  name: string;
  amount: string;
  per: Nutrients;
  ingredients: FoodEntry['ingredients'];
  healthScore: number;
  photoId?: number;
  createdAt: number;
  uses: number;
}
export interface ProgressPhoto { id?: number; date: string; photoId: number; createdAt: number }
/** The goal a day was logged against, so later weight or goal changes don't rewrite history. */
export interface DayGoal { date: string; targets: Targets }

class MorselDB extends Dexie {
  settings!: Table<Settings, 'me'>;
  entries!: Table<FoodEntry, number>;
  exercises!: Table<ExerciseEntry, number>;
  water!: Table<WaterEntry, number>;
  weights!: Table<WeightEntry, number>;
  photos!: Table<PhotoRow, number>;
  saved!: Table<SavedFood, number>;
  progressPhotos!: Table<ProgressPhoto, number>;
  dayGoals!: Table<DayGoal, string>;

  constructor() {
    super('morsel');
    this.version(1).stores({
      settings: 'id',
      entries: '++id, date, createdAt',
      exercises: '++id, date, createdAt',
      water: '++id, date',
      weights: '++id, date, createdAt',
      photos: '++id',
      saved: '++id, name, uses',
      progressPhotos: '++id, date',
    });
    this.version(2).stores({ dayGoals: 'date' });
  }
}

export const db = new MorselDB();

export const DEFAULT_AI: Settings['ai'] = {
  provider: 'claude',
  claudeKey: '',
  claudeModel: 'claude-opus-5-5',
  geminiKey: '',
  geminiModel: 'gemini-flash-latest',
};

export const getSettings = () => db.settings.get('me');

export async function patchSettings(patch: Partial<Settings>) {
  await db.settings.update('me', patch);
}

/** Ask the browser not to evict our data (Safari honours this for home-screen apps). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* ignore */
  }
}
