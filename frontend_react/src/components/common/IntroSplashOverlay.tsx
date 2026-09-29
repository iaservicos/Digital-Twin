import React, { useState, useEffect, useRef } from 'react';

interface IntroSplashOverlayProps {
  /** Callback disparado quando a animação de introdução termina */
  onFinish: () => void;
}

/**
 * Componente IntroSplashOverlay
 * Reprodução cinematográfica 100% limpa da animação de abertura do Brilha+:
 * - Mobile: Executa nativamente BrilhaMaisMobiV14.mp4 (1080x1920) em tela cheia edge-to-edge
 * - Desktop: Executa BrilhaMaisV6.mp4 (1920x1080, 16:9)
 * - Ativação de áudio prioritária no carregamento da página com desbloqueio síncrono instantâneo
 * - Zero controles permanentes na tela (apenas aviso sutil caso o navegador bloqueie o som)
 * - Reprodução completa do vídeo até o fim natural (onEnded) com transição cinematográfica
 */
export default function IntroSplashOverlay({ onFinish }: IntroSplashOverlayProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  // Detecção de dispositivo/orientação para carregar o vídeo mobile ou desktop
  const [videoSrc] = useState(() => {
    if (typeof window === 'undefined') return '/videos/BrilhaMaisV6.mp4';
    const isMobilePortrait = window.innerWidth < 768 || window.innerHeight > window.innerWidth;
    return isMobilePortrait
      ? '/videos/BrilhaMaisMobiV14.mp4'
      : '/videos/BrilhaMaisV6.mp4';
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  // Manipulador de encerramento da introdução e transição para o login
  const handleExit = () => {
    if (isExiting) return;
    setIsExiting(true);

    // Salva na sessão que a introdução já foi executada
    sessionStorage.setItem('brilha_intro_seen', 'true');

    // Transição cinematográfica suave de 600ms (Cyber Flare & Dissolve) antes de desmontar
    setTimeout(() => {
      onFinish();
    }, 600);
  };

  // Desbloqueia o som síncronamente no contexto de toque (obrigatório para iOS Safari e Chrome Mobile)
  const handleUnlockAudio = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.volume = 1.0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  };

  // Suporte silencioso a teclado: [ESC] ou [Espaço] permite avançar se o usuário desejar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Space') {
        e.preventDefault();
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExiting]);

  // Inicialização prioritária com áudio ativo no carregamento da página
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Tenta iniciar com áudio 100% ativo no carregamento
    video.muted = false;
    video.volume = 1.0;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn('Autoplay com áudio bloqueado pela política do navegador móvel:', error);
        // O navegador bloqueou áudio sem toque prévio do usuário.
        // Inicia o vídeo em modo mudo para não travar a reprodução visual:
        video.muted = true;
        video.play().catch(() => {});
      });
    }

    // Ouvinte em nível de janela para ativar o som no primeiríssimo toque ou clique em qualquer lugar
    const onFirstUserTouch = () => {
      handleUnlockAudio();
    };

    window.addEventListener('click', onFirstUserTouch, { once: true });
    window.addEventListener('touchend', onFirstUserTouch, { once: true });

    return () => {
      window.removeEventListener('click', onFirstUserTouch);
      window.removeEventListener('touchend', onFirstUserTouch);
    };
  }, [videoSrc]);

  return (
    <div
      onClick={handleUnlockAudio}
      onTouchEnd={handleUnlockAudio}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background overflow-hidden transition-all duration-700 ease-out select-none w-full h-full min-h-[100dvh] cursor-pointer ${
        isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Grade cibernética de fundo */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />

      {/* Camada de Flash Cibernético (Cyber Flare) disparada na transição de saída */}
      {isExiting && (
        <div className="absolute inset-0 bg-primary/25 z-40 animate-pulse pointer-events-none transition-opacity duration-500" />
      )}


      {/* 
        VÍDEO 100% TELA CHEIA (EDGE-TO-EDGE):
        - object-cover para preencher todo o display no smartphone sem barras pretas nem letterbox
        - Ocupa 100% da largura e altura visível (100dvh)
        - Reproduz até o final natural da animação (onEnded)
      */}
      <div className="relative w-full h-full min-h-[100dvh] flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          playsInline
          // @ts-ignore: atributo proprietário do iOS Safari
          webkit-playsinline="true"
          x5-playsinline="true"
          preload="auto"
          onLoadedData={() => setIsVideoLoaded(true)}
          onEnded={handleExit}
          onError={() => {
            console.error('Erro ao carregar o vídeo de introdução, avançando para o login.');
            onFinish();
          }}
          className={`w-full h-full min-h-[100dvh] object-cover transition-opacity duration-500 ${
            isVideoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Vinheta cinematográfica nas bordas */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(5,8,17,0.95)] sm:shadow-[inset_0_0_120px_rgba(5,8,17,0.95)]" />
      </div>
    </div>
  );
}
