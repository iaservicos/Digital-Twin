import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import * as SecureStore from '../utils/secureStore';
import { getBaseURL } from '../services/api';

export interface UserProfile {
  matricula: string;
  primeiroAcesso?: boolean;
  nomeCompleto?: string;
  cargo?: string;
  localEquipe?: string;
  role?: string;
  fotoPerfil?: string;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  idSessao: string | null;
  isLoading: boolean;
  setAuth: (token: string, user: UserProfile, idSessao?: string | null) => Promise<void>;
  updateUser: (userUpdates: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  idSessao: null,
  isLoading: true, // Começa carregando para evitar piscar a tela de login se já estiver logado

  setAuth: async (token: string, user: UserProfile, idSessao?: string | null) => {
    try {
      await SecureStore.setItemAsync('brilhamais_token', token);
      await SecureStore.setItemAsync('brilhamais_user', JSON.stringify(user));
      if (idSessao) {
        await SecureStore.setItemAsync('brilhamais_session_id', idSessao);
      }
      set({ token, user, idSessao: idSessao || null, isLoading: false });
    } catch (error) {
      console.error('Erro ao salvar no SecureStore:', error);
    }
  },

  updateUser: async (userUpdates: Partial<UserProfile>) => {
    try {
      const currentUser = get().user;
      if (!currentUser) return;

      // Sanitiza: remove base64 antes de persistir (nunca salva imagem no localStorage)
      const toStore: Partial<UserProfile> = { ...userUpdates };
      if (toStore.fotoPerfil?.startsWith('data:')) {
        delete toStore.fotoPerfil;
      }

      const updatedUser = { ...currentUser, ...toStore };
      await SecureStore.setItemAsync('brilhamais_user', JSON.stringify(updatedUser));
      // Estado em memória recebe a atualização completa (inclui base64 se houver, para exibição)
      set({ user: { ...currentUser, ...userUpdates } });
    } catch (error) {
      console.error('Erro ao atualizar usuário no SecureStore:', error);
      // Fallback: atualiza pelo menos o estado em memória se o localStorage falhar
      const currentUser = get().user;
      if (currentUser) set({ user: { ...currentUser, ...userUpdates } });
    }
  },

  logout: async () => {
    try {
      const currentSessionId = get().idSessao;
      if (currentSessionId && typeof navigator !== 'undefined') {
        try {
          const payload = JSON.stringify({ idSessao: currentSessionId });
          if (navigator.sendBeacon) {
            const endUrl = `${getBaseURL()}/auth/session/end`;
            navigator.sendBeacon(endUrl, payload);
          }
        } catch (e) {
          console.warn('Erro ao disparar encerramento de sessão no logout:', e);
        }
      }
      await SecureStore.deleteItemAsync('brilhamais_token');
      await SecureStore.deleteItemAsync('brilhamais_user');
      await SecureStore.deleteItemAsync('brilhamais_session_id');
      set({ token: null, user: null, idSessao: null, isLoading: false });
    } catch (error) {
      console.error('Erro ao deletar do SecureStore:', error);
    }
  },

  checkSession: async () => {
    try {
      await SecureStore.deleteItemAsync('brilhamais_token');
      await SecureStore.deleteItemAsync('brilhamais_user');
      await SecureStore.deleteItemAsync('brilhamais_session_id');
      set({ token: null, user: null, idSessao: null, isLoading: false });
    } catch (error) {
      console.error('Erro ao verificar/limpar sessão:', error);
      set({ token: null, user: null, idSessao: null, isLoading: false });
    }
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('brilhamais_token');
      const userStr = await SecureStore.getItemAsync('brilhamais_user');
      const sessionId = await SecureStore.getItemAsync('brilhamais_session_id');

      if (token && userStr) {
        // Valida se o token JWT ainda não expirou antes de restaurar a sessão
        try {
          const decoded: { exp?: number } = jwtDecode(token);
          const isExpired = decoded.exp ? decoded.exp * 1000 < Date.now() : false;

          if (isExpired) {
            // Token vencido: limpa o SecureStore e força novo login
            await SecureStore.deleteItemAsync('brilhamais_token');
            await SecureStore.deleteItemAsync('brilhamais_user');
            await SecureStore.deleteItemAsync('brilhamais_session_id');
            set({ token: null, user: null, idSessao: null, isLoading: false });
            return;
          }
        } catch {
          // Token malformado: trata como inválido
          await SecureStore.deleteItemAsync('brilhamais_token');
          await SecureStore.deleteItemAsync('brilhamais_user');
          await SecureStore.deleteItemAsync('brilhamais_session_id');
          set({ token: null, user: null, idSessao: null, isLoading: false });
          return;
        }

        // Parse seguro — dado corrompido no storage força login limpo
        let parsedUser: UserProfile;
        try {
          parsedUser = JSON.parse(userStr);
        } catch {
          await SecureStore.deleteItemAsync('brilhamais_token');
          await SecureStore.deleteItemAsync('brilhamais_user');
          await SecureStore.deleteItemAsync('brilhamais_session_id');
          set({ token: null, user: null, idSessao: null, isLoading: false });
          return;
        }

        set({ token, user: parsedUser, idSessao: sessionId || null, isLoading: false });
      } else {
        set({ token: null, user: null, idSessao: null, isLoading: false });
      }
    } catch (error) {
      set({ token: null, user: null, idSessao: null, isLoading: false });
    }
  },
}));
