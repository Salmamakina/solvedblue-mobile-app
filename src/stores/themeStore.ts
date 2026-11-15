import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

/**
 * The appearance preference: follow the phone, or override it.
 *
 * This was removed once on the argument that the phone's own setting is the
 * only one that matters, and restored because people do want the app pinned to
 * one appearance regardless of what the phone does at sunset. `system` is still
 * the default, so nothing changes for anyone who does not go looking.
 *
 * Stored in SecureStore rather than AsyncStorage only because the session
 * already lives there, so there is one storage dependency in the app instead of
 * two. There is nothing secret about a colour scheme.
 */
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
    // Applied first, stored second: the screen should repaint on the tap, not
    // after a write to disk has come back.
    set({ preference });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, preference);
    } catch {
      // Storage unavailable: the choice applies now but will not persist.
    }
  },
}));

/** Light first, then Dark, then System: the order iOS and Android both use. */
export const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];
