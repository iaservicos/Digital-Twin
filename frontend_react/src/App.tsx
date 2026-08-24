import { BrowserRouter } from 'react-router-dom';
import { useEffect } from 'react';
import AppRoutes from './navigation/AppRoutes';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const { theme, initializeTheme } = useThemeStore();
  const { hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (theme === 'dark' || (theme === 'system' && mediaQuery.matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // Listener para reagir a mudanças de tema do sistema operacional (quando 'system' estiver ativo)
    const listener = () => applyTheme();
    mediaQuery.addEventListener('change', listener);

    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  return (
    <BrowserRouter>
      {/* 
        Aqui no App.tsx ficam apenas os Providers globais da aplicação.
        Ex: BrowserRouter, AuthProvider, QueryClientProvider, ThemeProvider.
      */}
      <Toaster position="bottom-right" />
      <AppRoutes />
    </BrowserRouter>
  );
}
