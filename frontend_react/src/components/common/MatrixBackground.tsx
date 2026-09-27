import React, { useEffect, useRef } from 'react';

interface MatrixBackgroundProps {
  /** Opacidade global da camada de animação (padrão: 0.4 conforme diretriz) */
  opacity?: number;
  /** Tamanho base da fonte dos caracteres (pequeno e elegante) */
  fontSize?: number;
}

/**
 * Componente MatrixBackground
 * Renderiza em tempo real um plano de fundo dinâmico de chuva de dados Matrix
 * na GPU via HTML5 Canvas com consumo zero de banda de rede:
 * - Caracteres em tamanho pequeno e delicado para não poluir a interface
 * - Opacidade equilibrada a 40% para contraste perfeito com formulários
 * - Paleta oficial do sistema: Cyber Ciano Positivo (#00FFFF / #06b6d4 / #050811)
 * - Economia de recursos: pausa automática quando a aba está em segundo plano
 */
export default function MatrixBackground({
  opacity = 0.4,
  fontSize = 13,
}: MatrixBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let isTabVisible = true;
    let lastDrawTime = 0;
    const targetFps = 35; // 35 FPS proporciona queda suave e fluida com baixíssimo consumo de bateria
    const frameInterval = 1000 / targetFps;

    // Conjunto de caracteres tecnológicos: Binários, Katakana e operadores cibernéticos
    const CHARS = '01010101アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF+-*/<>=#$%&@';
    
    // Paleta de cores oficial do ecossistema Positivo / Brilha+
    const PALETTE = {
      bgFade: 'rgba(5, 8, 17, 0.085)',
      headColor: '#FFFFFF',
      headGlow: '#00FFFF',
      trailBright: '#00FFFF',
      trailMid: '#06b6d4',
      trailDark: '#0284c7',
      trailDim: 'rgba(8, 51, 68, 0.45)',
    };

    let columns = 0;
    let drops: number[] = [];
    let dropSpeeds: number[] = [];

    // Ajusta o tamanho e a nitidez do Canvas com suporte a Retina / Mobile DPR
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Limita a 2x DPR para eficiência energética
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Tamanho pequeno calibrado: 12px no mobile e 13px no desktop
      const effectiveFontSize = width < 768 ? Math.max(11, fontSize - 1) : fontSize;
      columns = Math.floor(width / (effectiveFontSize * 0.9));
      drops = [];
      dropSpeeds = [];

      for (let i = 0; i < columns; i++) {
        // Distribui posições verticais iniciais aleatórias para queda contínua
        drops[i] = Math.floor(Math.random() * -80);
        dropSpeeds[i] = 0.75 + Math.random() * 0.55;
      }

      // Preenche o fundo inicial escuro
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, width, height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Loop de renderização procedural
    const render = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(render);

      if (!isTabVisible) return;

      const elapsed = currentTime - lastDrawTime;
      if (elapsed < frameInterval) return;
      lastDrawTime = currentTime - (elapsed % frameInterval);

      const width = window.innerWidth;
      const height = window.innerHeight;
      const effectiveFontSize = width < 768 ? Math.max(11, fontSize - 1) : fontSize;

      // Efeito de rastro luminoso persistente
      ctx.fillStyle = PALETTE.bgFade;
      ctx.fillRect(0, 0, width, height);

      ctx.font = `700 ${effectiveFontSize}px 'JetBrains Mono', 'Segoe UI', monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * (effectiveFontSize * 0.9);
        const y = drops[i] * effectiveFontSize;

        // Cabeça da gota: branca fosforescente com halo ciano
        ctx.shadowBlur = 8;
        ctx.shadowColor = PALETTE.headGlow;
        ctx.fillStyle = PALETTE.headColor;
        ctx.fillText(char, x, y);

        // Rastro com gradiente ciano oficial do sistema
        const trailChar = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.shadowBlur = 4;
        ctx.shadowColor = PALETTE.trailBright;
        ctx.fillStyle = PALETTE.trailBright;
        ctx.fillText(trailChar, x, y - effectiveFontSize);

        ctx.shadowBlur = 0;
        ctx.fillStyle = PALETTE.trailMid;
        ctx.fillText(trailChar, x, y - effectiveFontSize * 2);

        ctx.fillStyle = PALETTE.trailDark;
        ctx.fillText(trailChar, x, y - effectiveFontSize * 3.2);

        ctx.fillStyle = PALETTE.trailDim;
        ctx.fillText(trailChar, x, y - effectiveFontSize * 4.5);

        // Reinicia a coluna quando ultrapassa a borda inferior com probabilidade orgânica
        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        drops[i] += dropSpeeds[i];
      }
    };

    animationFrameId = requestAnimationFrame(render);

    // Gerenciamento de economia de recursos ao alternar abas
    const handleVisibilityChange = () => {
      isTabVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fontSize]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-[#050811]"
    >
      {/* Camada Canvas Matrix com opacidade calibrada a 40% */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ opacity }}
      />
      {/* Vinheta radial escura para realçar e dar foco central ao formulário de login */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(5,8,17,0.9)] [background:radial-gradient(circle_at_center,transparent_40%,rgba(5,8,17,0.7)_100%)]" />
    </div>
  );
}
