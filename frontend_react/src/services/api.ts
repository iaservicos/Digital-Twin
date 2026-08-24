import axios from 'axios';
import * as SecureStore from '../utils/secureStore';

// Detecta a URL base do backend de forma dinâmica e resiliente
export const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_BACKEND_API_URL || import.meta.env.VITE_API_URL;
  
  if (envUrl) {
    let cleanUrl = envUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/api/v1')) {
      cleanUrl += '/api/v1';
    }
    return cleanUrl;
  }

  // Se em produção (Vercel/Web) sem env declarada, usa a URL oficial do Render
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://brilhamais-api-java.onrender.com/api/v1';
  }

  return 'http://localhost:8080/api/v1';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para injetar o Token em cada requisição
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('brilhamais_token');
      if (token) {
        if (config.headers && typeof config.headers.set === 'function') {
          config.headers.set('Authorization', `Bearer ${token}`);
        } else {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error('Erro ao recuperar token do SecureStore', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de resposta: trata expiração de sessão automaticamente
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const requestUrl: string = error.config?.url ?? '';

    // Evita loop infinito em rotas públicas de autenticação
    const isPublicRoute = requestUrl.includes('/auth/');

    // 401 = token expirado ou ausente → logout automático
    // 403 = autenticado, mas sem permissão para este recurso → NÃO faz logout
    if (status === 401 && !isPublicRoute) {
      try {
        const { useAuthStore } = await import('../store/authStore');
        await useAuthStore.getState().logout();
      } catch {
        await SecureStore.deleteItemAsync('brilhamais_token');
        await SecureStore.deleteItemAsync('brilhamais_user');
      }
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);
