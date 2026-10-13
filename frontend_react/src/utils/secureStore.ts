/**
 * Armazenamento seguro de sessão para credenciais e tokens.
 * Utiliza sessionStorage para garantir que a sessão expire imediatamente
 * ao fechar o navegador/aba, preservando os dados apenas durante recarregamento (F5).
 */
export const getItemAsync = async (key: string): Promise<string | null> => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    // Limpeza de segurança: remove tokens legados do localStorage para impedir persistência indevida
    if (window.localStorage && window.localStorage.getItem(key)) {
      window.localStorage.removeItem(key);
    }
    return window.sessionStorage.getItem(key);
  }
  return null;
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem(key, value);
    // Garante que não fique gravado no localStorage persistente
    if (window.localStorage && window.localStorage.getItem(key)) {
      window.localStorage.removeItem(key);
    }
  }
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  if (typeof window !== 'undefined') {
    if (window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
    if (window.localStorage) {
      window.localStorage.removeItem(key);
    }
  }
};

