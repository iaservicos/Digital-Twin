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

/**
 * 🎨 1. CORES DA MARCA (Compartilhadas entre Tema Claro e Escuro)
 * Alterar aqui atualiza os gráficos, gauges, botões neon e links em ambos os temas.
 */
export function hexToRgba(hex, alpha = 1) {
    if (!hex) return `rgba(138, 157, 177, ${alpha})`;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const themeColors = {
    get brand() { return this.dark; },

    // 🌙 TEMA ESCURO (Dark Mode - Cyber Digital Twin)
    dark: {
        // 📊 Tríade de Cores dos Gráficos (Data Viz) no Tema Escuro
        chart_primary: '#89A8B2',                           // Curva ativa do gráfico de ondas, arco preenchido do gauge de pontuação e barra em destaque no histograma de peças
        chart_track: '#3542469f',                           // Trilha inativa (fundo apagado do gauge circular) e base das barras vazias de peças
        chart_grid: '#a06b08ff',                            // Linhas da grade cartesiana pontilhada e eixos X/Y do gráfico de ondas

        // 🎨 Cores da Marca e Destaques
        primary: '#5F9598',                               // Botões primários ('Entrar', 'Sincronizar'), link ativo da sidebar, badges e brilhos neon
        primaryDark: '#3b4452ff',                           // Efeito hover de botões primários e relevos sombreados
        primaryLight: '#e9e6e7',                            // Texto/ícone dentro de botões com fundo escuro e iluminação sutil
        primaryTransparent: hexToRgba('#7294cfff', 0.15),   // Fundo de pílulas de filtro ativas ('Geral', 'Mês 1') e badges de status

        // 🏢 Estrutura e Superfícies da Interface
        background: '#141414',                              // Fundo geral da aplicação (tela inteira atrás dos cards) e base do Canvas GPU
        surface: '#1f1f1f',                                // Fundo dos Cards Bento (Pontuação, SLA, Chamados), painel lateral (Sidebar) e modais
        surfaceElevated: '#1f1f1f',                         // Caixas internas dentro dos cards (ex: área de datas de chamados, botão secundário)
        surfaceHover: '#020202ff',                            // Efeito hover ao passar o mouse sobre linhas de tabelas, listas e itens de menu

        // 🔲 Bordas e Divisórias
        border: '#1f1f1f',                                  // Bordas externas dos cards Bento, contorno de modais, tabelas e caixas de busca
        borderSubtle: '#262626',                            // Linhas divisórias internas discretas (ex: separadores entre cabeçalho e corpo do card)

        // ✍️ Tipografia e Textos
        textMain: '#BBBFBF',                                // Títulos dos cards, números grandes de pontuação/SLA e cabeçalhos principais
        textMuted: '#BBBFBF',                               // Textos secundários, legendas de metas (ex: 'Meta >= 90%') e rótulos auxiliares

        // 📝 Campos de Formulário
        inputBg: '#171717',                                 // Fundo dos campos de digitação (caixa de busca 'Buscar chamado', inputs de login e formulários)

        // 🔄 Aliases de Compatibilidade Retroativa (JavaScript e TypeScript)
        get chart() { return this.chart_primary; },         // Atalho compatível para a cor principal do gráfico
        get chartPrimary() { return this.chart_primary; },  // Atalho em camelCase para chart_primary
        get chartTrack() { return this.chart_track; },      // Atalho em camelCase para chart_track
        get chartGrid() { return this.chart_grid; },        // Atalho em camelCase para chart_grid
    },

    // ☀️ TEMA CLARO (Light Mode - Stone Clean)
    light: {
        // 📊 Tríade de Cores dos Gráficos (Data Viz) no Tema Claro
        chart_primary: '#3f94ad9f',                           // Curva ativa do gráfico de ondas, arco preenchido do gauge de pontuação e barra em destaque no histograma de peças
        chart_track: '#697f8663',                           // Trilha inativa (fundo apagado do gauge circular) e base das barras vazias de peças
        chart_grid: '#a06b08ff',                            // Linhas da grade cartesiana pontilhada e eixos X/Y do gráfico de ondas

        // 🎨 Cores da Marca e Destaques
        primary: '#7294cfff',                               // Botões primários ('Entrar', 'Sincronizar'), link ativo da sidebar, badges e destaques
        primaryDark: '#3b4452ff',                           // Efeito hover de botões primários e relevos sombreados
        primaryLight: '#e9e6e7',                            // Texto/ícone dentro de botões com fundo escuro e iluminação sutil
        primaryTransparent: hexToRgba('#7294cfff', 0.15),   // Fundo de pílulas de filtro ativas ('Geral', 'Mês 1') e badges de status

        // 🏢 Estrutura e Superfícies da Interface
        background: '#E5E1DA',                              // Fundo geral da aplicação (tela inteira atrás dos cards no tema claro - tom Stone suave)
        surface: '#EEEEEE',                                 // Fundo dos Cards Bento (Pontuação, SLA, Chamados), painel lateral (Sidebar) e modais
        surfaceElevated: '#E5E1DA',                         // Caixas internas dentro dos cards (ex: área branca de dias atendidos, botões secundários)
        surfaceHover: '#E5E1DA',                            // Efeito hover ao passar o mouse sobre linhas de tabelas, listas e itens de menu

        // 🔲 Bordas e Divisórias
        border: '#E5E1DA',                                  // Bordas externas dos cards Bento e divisórias suaves em harmonia com o fundo
        borderStrong: '#d6d3d1',                            // Bordas mais marcadas para inputs, tabelas e contorno de modais

        // ✍️ Tipografia e Textos
        textMain: '#1c1917',                                // Títulos dos cards, números grandes de pontuação/SLA e cabeçalhos principais (escuro nítido)
        textSecondary: '#44403c',                           // Textos de apoio, subtítulos e nomes de colunas das tabelas
        textMuted: '#78716c',                               // Textos auxiliares discretos, legendas de metas (ex: 'Meta >= 90%') e rodapés

        // 📝 Campos de Formulário
        inputBg: '#ffffff',                                 // Fundo dos campos de digitação (caixa de busca 'Buscar chamado', inputs de login e formulários)

        // 🔄 Aliases de Compatibilidade Retroativa (JavaScript e TypeScript)
        get chart() { return this.chart_primary; },         // Atalho compatível para a cor principal do gráfico
        get chartPrimary() { return this.chart_primary; },  // Atalho em camelCase para chart_primary
        get chartTrack() { return this.chart_track; },      // Atalho em camelCase para chart_track
        get chartGrid() { return this.chart_grid; },        // Atalho em camelCase para chart_grid
    },

    // 🚦 STATUS OPERACIONAL (Regras de Negócio e Metas)
    status: {
        success: '#10b981',                                 // Verde: SLA batido, 0 perdas, técnico elegível
        warning: '#f59e0b',                                 // Âmbar: Alertas de perdas de SLA e atenção
        danger: '#ef4444',                                  // Vermelho: SLA estourado, técnico inelegível
        info: '#3b82f6',                                    // Azul: Informativos e sincronização Databricks
    },

    // 🏢 INSTITUCIONAL POSITIVO
    corporativo: {
        primary: '#0f172a',                                 // Azul corporativo Positivo profundo
        secondary: '#1e293b',                               // Azul marinho secundário
        accent: '#3b82f6',                                  // Azul vibrante de destaque
        gold: '#eab308',                                    // Dourado: 1º lugar no ranking e medalhas
        goldLight: '#fef08a',                               // Realces dourados em premiações
    }
};

export const brandColors = themeColors.dark;

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
                chart: {
                    DEFAULT: themeColors.dark.chart_primary,
                    primary: themeColors.dark.chart_primary,
                    track: themeColors.dark.chart_track,
                    grid: themeColors.dark.chart_grid,
                },
                'chart-track': themeColors.dark.chart_track,
                'chart-grid': themeColors.dark.chart_grid,
                'accent-teal': themeColors.dark.primary,
                'accent-emerald': themeColors.dark.primaryDark,
                'input-bg': themeColors.dark.inputBg,

                // Paleta Light
                light: {
                    chart: themeColors.light.chart_primary,
                    chartPrimary: themeColors.light.chart_primary,
                    chartTrack: themeColors.light.chart_track,
                    chartGrid: themeColors.light.chart_grid,
                    'chart-track': themeColors.light.chart_track,
                    'chart-grid': themeColors.light.chart_grid,
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
                sans: ['Montserrat', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'bento': '1.5rem',
                'positivo-lg': '1rem',
                'positivo-md': '0.75rem',
                'positivo-sm': '0.5rem',
            },
            backdropBlur: {
                'bento': '0.125rem',
                'bento-hover': '0.25rem',
            },
            boxShadow: {
                'glow-primary': `0 0 8px ${hexToRgba(brandColors.primary, 0.18)}`,
                'glow-primary-sm': `0 0 4px ${hexToRgba(brandColors.primary, 0.12)}`,
                'glow-primary-lg': `0 0 16px ${hexToRgba(brandColors.primary, 0.22)}`,
                'sidebar': '8px 0 24px -4px rgba(0, 0, 0, 0.08), 2px 0 6px -2px rgba(0, 0, 0, 0.04)',
                'sidebar-dark': '14px 0 38px -4px rgba(0, 0, 0, 0.75), 4px 0 12px -2px rgba(0, 0, 0, 0.5)',
            },
            dropShadow: {
                'glow-primary': `0 0 6px ${hexToRgba(brandColors.primary, 0.18)}`,
                'glow-primary-lg': `0 0 12px ${hexToRgba(brandColors.primary, 0.25)}`,
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
            },
            animation: {
                float: 'float 6s ease-in-out infinite',
            },
        },
    },
    plugins: [
        function ({ addUtilities }) {
            addUtilities({
                '.scrollbar-hide': {
                    '-ms-overflow-style': 'none',
                    'scrollbar-width': 'none',
                    '&::-webkit-scrollbar': {
                        display: 'none',
                    },
                },
                '.dark-autofill': {
                    'caret-color': '#e2e8f0 !important',
                    '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
                        '-webkit-box-shadow': '0 0 0 30px #0f172a inset !important',
                        '-webkit-text-fill-color': '#e2e8f0 !important',
                        'transition': 'background-color 5000s ease-in-out 0s',
                    },
                },
                '.bg-grid-pattern': {
                    'background-color': themeColors.dark.background,
                    'background-image': `radial-gradient(circle at 50% 50%, ${hexToRgba(brandColors.primary, 0.06)} 0%, transparent 50%), linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
                    'background-size': '100% 100%, 40px 40px, 40px 40px',
                    'background-position': 'center center',
                },
                '.bg-grid-pattern-light': {
                    'background-color': themeColors.light.background,
                    'background-image': `radial-gradient(circle at 50% 50%, ${hexToRgba(brandColors.primary, 0.06)} 0%, transparent 50%), linear-gradient(rgba(15, 23, 42, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px)`,
                    'background-size': '100% 100%, 40px 40px, 40px 40px',
                    'background-position': 'center center',
                },
            });
        },
    ],
};

