import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'spyder-theme';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

interface ThemeState {
  preference: ThemePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      set({ preference: isPreference(stored) ? stored : 'system', hydrated: true });
    } catch {
      set({ preference: 'system', hydrated: true });
    }
  },

  setPreference: async (preference) => {
    set({ preference });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, preference);
    } catch {
      // Storage unavailable: the choice applies now but will not persist.
    }
  },
}));

export const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];
