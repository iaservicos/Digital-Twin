/**
 * Sistema de Constantes de Tema (Sincronizado diretamente com tailwind.config.js)
 * 
 * ⚠️ ATENÇÃO: NÃO altere cores neste arquivo!
 * Para alterar qualquer cor do sistema, edite EXCLUSIVAMENTE o arquivo:
 * 👉 tailwind.config.js
 */

import { themeColors, hexToRgba } from '../../tailwind.config.js';

export const THEME_COLORS = {
  get dark() {
    const primary = themeColors.dark.primary;
    return {
      bg: themeColors.dark.background,
      surface: themeColors.dark.surface,
      surfaceElevated: themeColors.dark.surfaceElevated,
      surfaceHover: themeColors.dark.surfaceHover,
      border: themeColors.dark.border,
      gridLines: hexToRgba(primary, 0.22),
      spotlight: hexToRgba(primary, 0.15),
      spotlightSecondary: hexToRgba(themeColors.dark.primaryDark || primary, 0.05),
      gridVertexHighlight: hexToRgba(primary, 0.45),
      primary: primary,
      chart: themeColors.dark.chart_primary || themeColors.dark.chart || primary,
      chartTrack: themeColors.dark.chart_track || themeColors.dark.chartTrack || '#333333',
      chartGrid: themeColors.dark.chart_grid || themeColors.dark.chartGrid || '#2a2a2a',
      cyanNeon: themeColors.dark.chart_primary || primary,
      cyanSecondary: themeColors.dark.chart_primary || primary,
    };
  },
  get light() {
    const primary = themeColors.light.primary;
    return {
      bg: themeColors.light.background,
      surface: themeColors.light.surface,
      surfaceElevated: themeColors.light.surfaceElevated,
      surfaceHover: themeColors.light.surfaceHover,
      border: themeColors.light.border,
      borderStrong: themeColors.light.borderStrong,
      gridLines: 'rgba(15, 23, 42, 0.06)',
      spotlight: hexToRgba(primary, 0.10),
      spotlightSecondary: hexToRgba(primary, 0.04),
      gridVertexHighlight: hexToRgba(primary, 0.35),
      primary: primary,
      chart: themeColors.light.chart_primary || themeColors.light.chart || primary,
      chartTrack: themeColors.light.chart_track || themeColors.light.chartTrack || '#cfc9be',
      chartGrid: themeColors.light.chart_grid || themeColors.light.chartGrid || '#c8c2b7',
      cyanNeon: themeColors.light.chart_primary || primary,
      cyanSecondary: themeColors.light.chart_primary || primary,
    };
  }
};

export type ThemeColors = typeof THEME_COLORS;
