import React, { useEffect, useRef } from 'react';
import { useThemeStore } from '../../store/themeStore';
import { THEME_COLORS } from '../../constants/theme';

export const InteractiveWaterRippleGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useThemeStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = 42; // Espaçamento suave da malha geométrica

    const drawGrid = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const themeToken = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = themeToken.bg;
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 1;
      ctx.strokeStyle = themeToken.gridLines;

      // Linhas Horizontais Estáticas
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Linhas Verticais Estáticas
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      ctx.restore();
    };

    drawGrid();
    window.addEventListener('resize', drawGrid);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => drawGrid();
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('resize', drawGrid);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-300"
      style={{ opacity: 1 }}
    />
  );
};

export default InteractiveWaterRippleGrid;
