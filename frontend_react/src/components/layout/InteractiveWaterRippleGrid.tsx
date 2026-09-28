import React, { useEffect, useRef } from 'react';
import { useThemeStore } from '../../store/themeStore';
import { THEME_COLORS } from '../../constants/theme';

interface GridPoint {
  ox: number; // Base x original
  oy: number; // Base y original
  x: number;  // Current x
  y: number;  // Current y
  vx: number; // Velocity x
  vy: number; // Velocity y
}

interface RippleWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  strength: number;
  speed: number;
}

export const InteractiveWaterRippleGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme, backgroundDistortion } = useThemeStore();
  const pointsRef = useRef<GridPoint[][]>([]);
  const ripplesRef = useRef<RippleWave[]>([]);
  const mouseRef = useRef<{ x: number; y: number; active: boolean; lastX: number; lastY: number }>({
    x: -1000,
    y: -1000,
    active: false,
    lastX: -1000,
    lastY: -1000
  });
  const lastSpawnRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const themeToken = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
    const gridSize = 42; // Espaçamento suave da malha

    // Se o usuário desativar a distorção nas configurações, renderiza a malha estática sem loop de animação
    if (!backgroundDistortion) {
      const drawStaticGrid = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
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
      };

      drawStaticGrid();
      window.addEventListener('resize', drawStaticGrid);
      return () => {
        window.removeEventListener('resize', drawStaticGrid);
      };
    }

    const initGrid = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const cols = Math.ceil(width / gridSize) + 3;
      const rows = Math.ceil(height / gridSize) + 3;

      const newPoints: GridPoint[][] = [];
      for (let i = 0; i < cols; i++) {
        newPoints[i] = [];
        for (let j = 0; j < rows; j++) {
          const ox = (i - 1) * gridSize;
          const oy = (j - 1) * gridSize;
          newPoints[i][j] = {
            ox,
            oy,
            x: ox,
            y: oy,
            vx: 0,
            vy: 0,
          };
        }
      }
      pointsRef.current = newPoints;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      initGrid();
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e: MouseEvent) => {
      const { x: prevX, y: prevY } = mouseRef.current;
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
        active: true,
        lastX: prevX,
        lastY: prevY
      };

      const now = performance.now();
      // Ondas líquidas que viajam pela malha com o movimento do cursor
      const distMoved = Math.hypot(e.clientX - prevX, e.clientY - prevY);
      if (distMoved > 8 && now - lastSpawnRef.current > 75) {
        lastSpawnRef.current = now;
        ripplesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          radius: 4,
          maxRadius: Math.min(window.innerWidth, window.innerHeight) * 0.35,
          strength: Math.min(distMoved * 0.35, 14),
          speed: 3.2,
        });

        if (ripplesRef.current.length > 8) {
          ripplesRef.current.shift();
        }
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      ctx.clearRect(0, 0, width, height);

      // Fundo Base governado pelo token THEME_COLORS (app.bg no Dark, light.bg no Light)
      ctx.fillStyle = themeToken.bg;
      ctx.fillRect(0, 0, width, height);

      const points = pointsRef.current;
      const cols = points.length;
      if (cols === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      const rows = points[0].length;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const isMouseActive = mouseRef.current.active;
      const mouseInfluenceRadius = 175;

      // 1. Atualização da física de distorção de cada vértice do grid
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const p = points[i][j];
          let targetX = p.ox;
          let targetY = p.oy;

          // (A) Efeito de Distorção Elástica ao redor do Mouse
          if (isMouseActive) {
            const dx = p.ox - mx;
            const dy = p.oy - my;
            const dist = Math.hypot(dx, dy);

            if (dist < mouseInfluenceRadius && dist > 0.01) {
              const factor = Math.pow(1 - dist / mouseInfluenceRadius, 2);
              const push = factor * 26; // intensidade máxima de curvatura
              targetX += (dx / dist) * push;
              targetY += (dy / dist) * push;
            }
          }

          // (B) Ondulações Líquidas viajando pela malha
          for (let r = 0; r < ripplesRef.current.length; r++) {
            const wave = ripplesRef.current[r];
            const rdx = p.ox - wave.x;
            const rdy = p.oy - wave.y;
            const rDist = Math.hypot(rdx, rdy);
            const waveDelta = Math.abs(rDist - wave.radius);
            const waveBand = 40;

            if (waveDelta < waveBand && rDist > 0.01) {
              const waveProgress = 1 - wave.radius / wave.maxRadius;
              const waveAmp = Math.sin((1 - waveDelta / waveBand) * Math.PI) * wave.strength * waveProgress;
              targetX += (rdx / rDist) * waveAmp;
              targetY += (rdy / rDist) * waveAmp;
            }
          }

          // Física de mola (Spring Physics) com amortecimento suave
          p.vx = (p.vx + (targetX - p.x) * 0.12) * 0.82;
          p.vy = (p.vy + (targetY - p.y) * 0.12) * 0.82;
          p.x += p.vx;
          p.y += p.vy;
        }
      }

      // Atualiza o progresso das ondas líquidas
      for (let r = ripplesRef.current.length - 1; r >= 0; r--) {
        const wave = ripplesRef.current[r];
        wave.radius += wave.speed;
        wave.strength *= 0.985;
        if (wave.radius >= wave.maxRadius || wave.strength <= 0.2) {
          ripplesRef.current.splice(r, 1);
        }
      }

      // 2. Renderização das Linhas Horizontais Distorcidas (usando token themeToken.gridLines)
      ctx.lineWidth = 1;
      ctx.strokeStyle = themeToken.gridLines;

      for (let j = 0; j < rows; j++) {
        ctx.beginPath();
        ctx.moveTo(points[0][j].x, points[0][j].y);

        for (let i = 1; i < cols - 1; i++) {
          const xc = (points[i][j].x + points[i + 1][j].x) / 2;
          const yc = (points[i][j].y + points[i + 1][j].y) / 2;
          ctx.quadraticCurveTo(points[i][j].x, points[i][j].y, xc, yc);
        }

        ctx.lineTo(points[cols - 1][j].x, points[cols - 1][j].y);
        ctx.stroke();
      }

      // 3. Renderização das Linhas Verticais Distorcidas
      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        ctx.moveTo(points[i][0].x, points[i][0].y);

        for (let j = 1; j < rows - 1; j++) {
          const xc = (points[i][j].x + points[i][j + 1].x) / 2;
          const yc = (points[i][j].y + points[i][j + 1].y) / 2;
          ctx.quadraticCurveTo(points[i][j].x, points[i][j].y, xc, yc);
        }

        ctx.lineTo(points[i][rows - 1].x, points[i][rows - 1].y);
        ctx.stroke();
      }

      // NOTA: A sombra esverdeada e os pontinhos nos vértices foram removidos
      // a pedido do usuário, deixando puramente a distorção elástica das linhas.

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, backgroundDistortion]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-300"
      style={{ opacity: 1 }}
    />
  );
};

export default InteractiveWaterRippleGrid;

