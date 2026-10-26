import type { Tables } from '@/integrations/supabase/types';
import { buildLessons, type Lesson } from '@/lib/curriculum';

export type SavedModule = { id: string; title: string; provider: string; savedAt: string; lessons: Lesson[] };
const KEY = 'wrcan-offline-modules-v1';
export function readSavedModules(): SavedModule[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedModule[]; } catch { return []; }
}
export function saveOfflineModule(mod: Tables<'training_modules'>) {
  const saved: SavedModule = { id: mod.id, title: mod.title, provider: mod.provider, savedAt: new Date().toISOString(), lessons: buildLessons(mod) };
  localStorage.setItem(KEY, JSON.stringify([...readSavedModules().filter(m => m.id !== mod.id), saved]));
}
export function removeOfflineModule(id: string) {
  localStorage.setItem(KEY, JSON.stringify(readSavedModules().filter(m => m.id !== id)));
  localStorage.removeItem(`wrcan-learning-draft-${id}`);
}