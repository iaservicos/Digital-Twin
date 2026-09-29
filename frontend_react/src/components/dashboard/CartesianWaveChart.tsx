import React from 'react';
import { THEME_COLORS } from '../../constants/theme';
import { useThemeStore } from '../../store/themeStore';

export interface DataPoint {
  label: string;
  value: number;
}

interface CartesianWaveChartProps {
  data: DataPoint[];
  color?: string;
  gradientId?: string;
  height?: number | string;
  showPoints?: boolean;
}

export default function CartesianWaveChart({
  data,
  color,
  gradientId = 'cartesianWaveGrad',
  height = '7.5rem',
  showPoints = true,
}: CartesianWaveChartProps) {
  const { theme } = useThemeStore();
  const themeTokens = theme === 'light' ? THEME_COLORS.light : THEME_COLORS.dark;
  const strokeColor = color || (themeTokens as any).chart || themeTokens.primary || themeTokens.cyanNeon;
  const secondaryColor = (themeTokens as any).chart || themeTokens.primary || themeTokens.cyanSecondary;
  const gridColor = (themeTokens as any).chartGrid || themeTokens.border;
  const surfaceColor = themeTokens.surface;

  if (!data || data.length === 0) {
    return null;
  }

  // Dimensões do viewBox (expandido verticalmente para evitar ondas achatadas)
  const viewBoxWidth = 280;
  const viewBoxHeight = 110;

  // Margens para acomodar eixos X e Y
  const margin = {
    top: 14,
    right: 18,
    bottom: 24,
    left: 32,
  };

  const plotWidth = viewBoxWidth - margin.left - margin.right;
  const plotHeight = viewBoxHeight - margin.top - margin.bottom;

  // Escala Y
  const rawMax = Math.max(...data.map((d) => d.value), 0);
  const yMax = rawMax === 0 ? 5 : Math.ceil(rawMax * 1.15);
  const yMin = 0;
  const yMid = Math.round((yMax + yMin) / 2);

  // Mapeamento dos pontos (x, y)
  const points = data.map((d, index) => {
    const x =
      data.length > 1
        ? margin.left + (index / (data.length - 1)) * plotWidth
        : margin.left + plotWidth / 2;
    const yRatio = (d.value - yMin) / (yMax - yMin || 1);
    const y = margin.top + plotHeight - yRatio * plotHeight;
    return { x, y, ...d };
  });

  // Geração de curva suave (Catmull-Rom / Bézier cúbica)
  const getCurvePath = (pts: typeof points): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    return path;
  };

  const curveD = getCurvePath(points);
  const bottomY = margin.top + plotHeight;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaD = `${curveD} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;

  return (
    <div className="w-full relative select-none" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
      <svg
        className="w-full h-full overflow-visible"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
      >
        <defs>
          {/* Gradiente luminoso sob a curva */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
            <stop offset="50%" stopColor={secondaryColor} stopOpacity="0.12" />
            <stop offset="100%" stopColor={secondaryColor} stopOpacity="0" />
          </linearGradient>

          {/* Filtro de brilho neon */}
          <filter id={`glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={strokeColor} floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Linhas de Grade Cartesianas Sutis (Eixo Y) */}
        {[yMax, yMid, yMin].map((val, idx) => {
          const y = margin.top + (idx / 2) * plotHeight;
          return (
            <g key={`y-grid-${idx}`}>
              <line
                x1={margin.left}
                y1={y}
                x2={margin.left + plotWidth}
                y2={y}
                stroke={gridColor}
                strokeDasharray={idx === 2 ? '0' : '3 3'}
                strokeWidth={idx === 2 ? '1.5' : '1.0'}
              />
              <text
                x={margin.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-light-text-muted dark:fill-text-muted"
                style={{ fontSize: '8px', fontWeight: 600, fontFamily: 'monospace' }}
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Linha vertical do Eixo Y */}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={bottomY}
          stroke={gridColor}
          strokeWidth="1.5"
        />

        {/* Área preenchida com gradiente sob a curva */}
        <path d={areaD} fill={`url(#${gradientId})`} />

        {/* Curva fluida neon principal */}
        <path
          d={curveD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${strokeColor}66)` }}
        />

        {/* Rótulos do Eixo X (Semanas ou Dias) */}
        {points.map((pt, idx) => (
          <text
            key={`x-label-${idx}`}
            x={pt.x}
            y={viewBoxHeight - 4}
            textAnchor="middle"
            className="fill-light-text-muted dark:fill-text-muted"
            style={{ fontSize: '8px', fontWeight: 600 }}
          >
            {pt.label}
          </text>
        ))}

        {/* Pontos discretos nos nós da curva */}
        {showPoints &&
          points.map((pt, idx) => {
            const isLast = idx === points.length - 1;
            return (
              <g key={`pt-${idx}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isLast ? 3.5 : 2}
                  fill={isLast ? strokeColor : surfaceColor}
                  stroke={strokeColor}
                  strokeWidth={isLast ? 2 : 1.5}
                  style={isLast ? { filter: `drop-shadow(0 0 6px ${strokeColor})` } : undefined}
                />
                {isLast && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={6}
                    fill={strokeColor}
                    fillOpacity="0.25"
                    className="animate-pulse"
                  />
                )}
              </g>
            );
          })}
      </svg>
    </div>
  );
}
