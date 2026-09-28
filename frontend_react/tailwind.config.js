/**
 * =============================================================================
 * 🎨 ARQUIVO ÚNICO DE ESTILIZAÇÃO & DESIGN TOKENS (SSOT) - BRILHA+
 * =============================================================================
 * Este é o ÚNICO arquivo do projeto onde você deve alterar ou personalizar cores.
 * Qualquer alteração feita aqui reflete automaticamente em:
 * 1. Classes utilitárias do Tailwind (ex: bg-background, bg-surface, text-primary)
 * 2. Efeitos procedurais do Canvas GPU (InteractiveWaterRippleGrid e Matrix)
 * 3. Gráficos SVG (CartesianWaveChart e gauges circulares)
 * =============================================================================
 */

export const themeColors = {
    // 🌙 TEMA ESCURO OFICIAL (Cyber Navy)
    /*dark: {
      background: '#040d1c',               // Fundo principal de toda a aplicação e do canvas
      surface: '#0a0f1d',                  // Fundo dos Cards Bento, Modais e Sidebar
      surfaceElevated: '#0e1426',          // Caixas internas elevadas (card de perfil, selects)
      surfaceHover: '#131b32',             // Cor de hover ao passar o mouse em botões e linhas
      border: '#1e293b',                   // Bordas principais dos cartões e divisórias
      borderSubtle: '#151e32',             // Bordas secundárias mais discretas
      primary: '#22d3ee',                  // Ciano neon oficial do Brilha+ (destaques, gráficos)
      primaryDark: '#0891b2',              // Ciano escuro para botões pressionados / hover
      primaryLight: '#67e8f9',             // Ciano claro para iluminação e realces
      primaryTransparent: 'rgba(34, 211, 238, 0.15)', // Pílulas e ícones translúcidos
      textMain: '#f8fafc',                 // Texto principal (títulos e métricas grandes)
      textMuted: '#94a3b8',                // Texto secundário (legendas, rótulos e datas)
      inputBg: '#070b14',                  // Fundo escuro para campos de digitação e filtros
    },*/
    dark: {
        background: '#141414',                             // Fundo principal de toda a aplicação e do canvas
        surface: '#1f1f1f',                                // Fundo dos Cards Bento, Modais e Sidebar
        surfaceElevated: '#2a2a2a',                        // Caixas internas elevadas (card de perfil, selects)
        surfaceHover: '#2e2e2e',                           // Cor de hover ao passar o mouse em botões e linhas
        border: '#333333',                                 // Bordas principais dos cartões e divisórias
        borderSubtle: '#262626',                           // Bordas secundárias mais discretas
        primary: '#22d3ee',                                // Ciano neon oficial do Brilha+ (destaques, gráficos)
        primaryDark: '#0891b2',                            // Ciano escuro para botões pressionados / hover
        primaryLight: '#67e8f9',                           // Ciano claro para iluminação e realces
        primaryTransparent: 'rgba(34, 211, 238, 0.15)',    // Pílulas e ícones translúcidos
        textMain: '#f5f5f5',                               // Texto principal (títulos e métricas grandes)
        textMuted: '#a3a3a3',                              // Texto secundário (legendas, rótulos e datas)
        inputBg: '#171717',                                // Fundo escuro para campos de digitação e filtros
    },


    // ☀️ TEMA CLARO OFICIAL (Clean Slate)
    /* light: {
         background: '#f8fafc',               // Fundo principal no modo claro (Slate 50)
         surface: '#ffffff',                  // Fundo branco dos cards e da sidebar
         surfaceElevated: '#f1f5f9',          // Superfícies elevadas internas (Slate 100)
         surfaceHover: '#e2e8f0',             // Cor de hover no modo claro (Slate 200)
         border: '#e2e8f0',                   // Bordas dos cards no modo claro
         borderStrong: '#cbd5e1',             // Bordas mais marcadas para contraste
         primary: '#0891b2',                  // Teal escuro para boa legibilidade sob fundo claro
         primaryDark: '#0e7490',              // Variação escura de botão
         primaryLight: '#22d3ee',             // Realce suave
         primaryTransparent: 'rgba(8, 145, 178, 0.12)',
         textMain: '#0f172a',                 // Texto principal escuro (Slate 900)
         textSecondary: '#334155',            // Texto secundário (Slate 700)
         textMuted: '#64748b',                // Legendas suaves (Slate 500)
         inputBg: '#ffffff',                  // Fundo de inputs no modo claro
     },*/
    light: {
        /* Fundo azul muito suave (sky-50) e textos em tom de azul marinho. Traz cor mantendo a herança neon do Brilha+. */
        background: '#32353d38',               // Fundo principal
        surface: '#ffffff',                    // Fundo dos Cards Bento (Sempre Branco!)
        surfaceElevated: '#e0f2fe',             // Caixas internas e seletors
        surfaceHover: '#e0f2fe',             // Cor de hover suave
        border: '#bae6fd',             // Bordas principais
        borderStrong: '#cbd5e1',             // Bordas bem discretas
        primary: '#0ea5e9',             // Cor de destaque com bom contraste
        primaryDark: '#0284c7',             // Hover do botão
        primaryLight: '#7dd3fc',             // Realces sutis
        primaryTransparent: 'rgba(14, 165, 233, 0.15)', // Fundos translúcidos
        textMain: '#0c4a6e',
        textSecondary: '#334155',             // Texto principal escuro
        textMuted: '#475569',             // Texto secundário cinza
        inputBg: '#ffffff',
    },

    // 🚦 CORES DE STATUS OPERACIONAL (KPIs & METAS)
    status: {
        success: '#10b981',                  // Verde (meta batida / elegível para premiação)
        warning: '#f59e0b',                  // Âmbar (atenção / intermediário)
        danger: '#ef4444',                   // Vermelho (meta perdida / não elegível)
        info: '#3b82f6',                     // Azul neutro informativo
    },

    // 🏢 CORES INSTITUCIONAIS POSITIVO
    corporativo: {
        primary: '#0f172a',                  // Azul Positivo profundo
        secondary: '#1e293b',
        accent: '#3b82f6',
        gold: '#eab308',                     // Dourado Brilha+
        goldLight: '#fef08a',
    }
};

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Mapeamento direto das cores para classes utilitárias do Tailwind
                background: themeColors.dark.background,
                surface: {
                    DEFAULT: themeColors.dark.surface,
                    elevated: themeColors.dark.surfaceElevated,
                    hover: themeColors.dark.surfaceHover,
                },
                border: {
                    DEFAULT: themeColors.dark.border,
                    subtle: themeColors.dark.borderSubtle,
                },
                text: {
                    main: themeColors.dark.textMain,
                    muted: themeColors.dark.textMuted,
                },
                primary: {
                    DEFAULT: themeColors.dark.primary,
                    dark: themeColors.dark.primaryDark,
                    light: themeColors.dark.primaryLight,
                    transparent: themeColors.dark.primaryTransparent,
                },
                'accent-teal': themeColors.dark.primary,
                'accent-emerald': themeColors.dark.primaryDark,
                'input-bg': themeColors.dark.inputBg,

                // Paleta Light
                light: {
                    background: themeColors.light.background,
                    surface: {
                        DEFAULT: themeColors.light.surface,
                        elevated: themeColors.light.surfaceElevated,
                        hover: themeColors.light.surfaceHover,
                    },
                    border: themeColors.light.border,
                    borderStrong: themeColors.light.borderStrong,
                    text: {
                        main: themeColors.light.textMain,
                        secondary: themeColors.light.textSecondary,
                        muted: themeColors.light.textMuted,
                    }
                },

                // Status
                status: themeColors.status,

                // Positivo Corporativo
                positivo: {
                    primary: themeColors.corporativo.primary,
                    secondary: themeColors.corporativo.secondary,
                    accent: themeColors.corporativo.accent,
                },
                brilhamais: {
                    gold: themeColors.corporativo.gold,
                    light: themeColors.corporativo.goldLight,
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'positivo-lg': '16px',
                'positivo-md': '12px',
                'positivo-sm': '8px',
            }
        },
    },
    plugins: [],
};
