import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  backgroundDistortion: boolean;
  setTheme: (theme: ThemeMode) => void;
  setBackgroundDistortion: (enabled: boolean) => void;
  toggleBackgroundDistortion: () => void;
  initializeTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark', // Valor padrão oficial (tema escuro cyber digital twin)
  backgroundDistortion: localStorage.getItem('brilhamais_bg_distortion') !== 'false', // Padrão: true

  setTheme: (theme: ThemeMode) => {
    localStorage.setItem('brilhamais_theme', theme);
    set({ theme });
  },

  setBackgroundDistortion: (enabled: boolean) => {
    localStorage.setItem('brilhamais_bg_distortion', String(enabled));
    set({ backgroundDistortion: enabled });
  },

  toggleBackgroundDistortion: () => {
    const nextState = !get().backgroundDistortion;
    localStorage.setItem('brilhamais_bg_distortion', String(nextState));
    set({ backgroundDistortion: nextState });
  },

  initializeTheme: () => {
    const storedTheme = localStorage.getItem('brilhamais_theme') as ThemeMode;
    if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
      set({ theme: storedTheme });
    } else {
      set({ theme: 'dark' });
    }

    const storedDistortion = localStorage.getItem('brilhamais_bg_distortion');
    if (storedDistortion !== null) {
      set({ backgroundDistortion: storedDistortion !== 'false' });
    }
  }
}));

