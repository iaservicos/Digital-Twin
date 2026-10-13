import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

// Tempo de inatividade limite: 3 minutos (180.000 ms)
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000;
// Intervalo de verificação periódica do temporizador: 5 segundos
const CHECK_INTERVAL_MS = 5000;
// Throttle de atualização de eventos para poupar CPU: 1 segundo
const THROTTLE_MS = 1000;

/**
 * Hook global para monitoramento de inatividade do usuário.
 * Após 3 minutos sem interação (mouse, teclado, touch, scroll),
 * desloga automaticamente o usuário, notifica via toast e redireciona ao login.
 */
export function useInactivityTimeout() {
  const { token, logout } = useAuthStore();
  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);

  useEffect(() => {
    // Apenas monitora inatividade se houver sessão/token ativo
    if (!token) {
      isLoggingOutRef.current = false;
      return;
    }

    // Inicializa o timestamp no momento em que a sessão é confirmada
    lastActivityRef.current = Date.now();
    isLoggingOutRef.current = false;

    // Registra atividade com throttle
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current > THROTTLE_MS) {
        lastActivityRef.current = now;
        lastThrottleRef.current = now;
      }
    };

    // Eventos que caracterizam presença e uso ativo da aplicação
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'touchstart',
      'touchmove',
      'scroll',
      'wheel',
      'click'
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    // Verificação periódica a cada CHECK_INTERVAL_MS
    const intervalId = setInterval(async () => {
      if (isLoggingOutRef.current) return;

      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        isLoggingOutRef.current = true;
        
        // Exibe aviso claro para o usuário
        toast.error(
          'Sua sessão expirou após 3 minutos de inatividade por motivos de segurança. Faça login novamente.',
          {
            id: 'inactivity-timeout-toast',
            duration: 8000
          }
        );

        try {
          await logout();
        } catch (e) {
          console.error('Erro ao efetuar logout por inatividade:', e);
        }
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
    };
  }, [token, logout]);
}
