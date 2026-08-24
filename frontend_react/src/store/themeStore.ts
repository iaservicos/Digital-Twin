import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  initializeTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system', // Valor padrão

  setTheme: (theme: ThemeMode) => {
    localStorage.setItem('brilhamais_theme', theme);
    set({ theme });
  },

  initializeTheme: () => {
    const storedTheme = localStorage.getItem('brilhamais_theme') as ThemeMode;
    if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
      set({ theme: storedTheme });
    }
  }
}));
