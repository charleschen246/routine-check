import type { RoutineEntry, UserPreferences } from './types';

const ROUTINE_KEY = 'routine';
const PREFS_KEY = 'preferences';

export async function getRoutine(): Promise<RoutineEntry[]> {
  const result = await chrome.storage.local.get(ROUTINE_KEY);
  return (result[ROUTINE_KEY] as RoutineEntry[] | undefined) ?? [];
}

export async function setRoutine(routine: RoutineEntry[]): Promise<void> {
  await chrome.storage.local.set({ [ROUTINE_KEY]: routine });
}

export async function getPreferences(): Promise<UserPreferences> {
  const result = await chrome.storage.local.get(PREFS_KEY);
  return (result[PREFS_KEY] as UserPreferences | undefined) ?? {};
}

export async function setPreferences(prefs: UserPreferences): Promise<void> {
  await chrome.storage.local.set({ [PREFS_KEY]: prefs });
}
