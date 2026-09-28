/**
 * Sistema de Constantes de Tema (Sincronizado diretamente com tailwind.config.js)
 * 
 * ⚠️ ATENÇÃO: NÃO altere cores neste arquivo!
 * Para alterar qualquer cor do sistema, edite EXCLUSIVAMENTE o arquivo:
 * 👉 tailwind.config.js
 */

import { themeColors } from '../../tailwind.config.js';

export const THEME_COLORS = {
  get dark() {
    return {
      bg: themeColors.dark.background,
      surface: themeColors.dark.surface,
      surfaceElevated: themeColors.dark.surfaceElevated,
      surfaceHover: themeColors.dark.surfaceHover,
      border: themeColors.dark.border,
      gridLines: 'rgba(34, 211, 238, 0.08)',
      spotlight: 'rgba(34, 211, 238, 0.12)',
      spotlightSecondary: 'rgba(8, 145, 178, 0.04)',
      gridVertexHighlight: 'rgba(34, 211, 238, 0.45)',
      cyanNeon: themeColors.dark.primary,
      cyanSecondary: '#38bdf8',
    };
  },
  get light() {
    return {
      bg: themeColors.light.background,
      surface: themeColors.light.surface,
      surfaceElevated: themeColors.light.surfaceElevated,
      surfaceHover: themeColors.light.surfaceHover,
      border: themeColors.light.border,
      borderStrong: themeColors.light.borderStrong,
      gridLines: 'rgba(15, 23, 42, 0.06)',
      spotlight: 'rgba(8, 145, 178, 0.10)',
      spotlightSecondary: 'rgba(14, 165, 233, 0.04)',
      gridVertexHighlight: 'rgba(8, 145, 178, 0.35)',
      cyanNeon: themeColors.light.primary,
      cyanSecondary: '#0284c7',
    };
  }
};

export type ThemeColors = typeof THEME_COLORS;
