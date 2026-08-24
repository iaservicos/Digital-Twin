import axios from 'axios';
import * as SecureStore from '../utils/secureStore';

// Detecta o IP dinamicamente para Web
const getBaseURL = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
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
        // Importação lazy para evitar dependência circular
        const { useAuthStore } = await import('../store/authStore');
        await useAuthStore.getState().logout();
      } catch {
        // Fallback: limpa manualmente se o store falhar
        await SecureStore.deleteItemAsync('brilhamais_token');
        await SecureStore.deleteItemAsync('brilhamais_user');
      }
      // Redireciona para login sem usar React Router (contexto pode não existir)
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);


