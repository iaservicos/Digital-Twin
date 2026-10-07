import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { api, getBaseURL } from '../services/api';

const HEARTBEAT_INTERVAL_MS = 60000; // 60 segundos

export function useSessionHeartbeat() {
  const { token, idSessao } = useAuthStore();
  const sessionRef = useRef<string | null>(idSessao);

  useEffect(() => {
    sessionRef.current = idSessao;
  }, [idSessao]);

  useEffect(() => {
    if (!token || !idSessao) return;

    // Função de envio do ping periódico
    const sendPing = async () => {
      try {
        if (typeof document !== 'undefined' && document.hidden) {
          // Aba minimizada/em segundo plano: ainda envia ping para manter tempo correto, se permitido
        }
        await api.post('/auth/session/ping', { idSessao });
      } catch (err) {
        // Silencioso em caso de falha de conexão transitória
      }
    };

    // Dispara o primeiro ping logo após montar se já tiver sessão
    sendPing();

    const intervalId = setInterval(sendPing, HEARTBEAT_INTERVAL_MS);

    // Encerramento limpo via Beacon API quando a página for fechada ou recarregada
    const handlePageHide = () => {
      const activeSession = sessionRef.current;
      if (activeSession && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const payload = JSON.stringify({ idSessao: activeSession });
        const endUrl = `${getBaseURL()}/auth/session/end`;
        navigator.sendBeacon(endUrl, payload);
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [token, idSessao]);
}
