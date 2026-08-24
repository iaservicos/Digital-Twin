import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore, ThemeMode } from '../store/themeStore';
import { LogOut, Sun, Moon, Monitor, User, Settings, HelpCircle } from 'lucide-react';
import ModalConfiguracoes from '../components/layout/ModalConfiguracoes';
import ModalAjuda from '../components/layout/ModalAjuda';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAjudaOpen, setIsAjudaOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const themeOptions: { value: ThemeMode; label: string; icon: any }[] = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-2xl font-bold text-light-text-main dark:text-text-main">Perfil</h1>

      {/* Cartão de Informações do Usuário */}
      <div className="bg-light-surface dark:bg-surface p-6 rounded-positivo-lg shadow-sm border border-light-border dark:border-border flex flex-col items-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 overflow-hidden bg-slate-200 dark:bg-positivo-secondary border border-light-borderStrong dark:border-border">
          {user?.fotoPerfil ? (
            <img src={user.fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
          ) : (
            <User size={40} className="text-light-text-muted dark:text-light-text-muted" />
          )}
        </div>
        <h2 className="text-xl font-bold text-light-text-main dark:text-text-main text-center">
          {user?.nomeCompleto || 'Usuário Brilha Mais'}
        </h2>
        <p className="text-sm font-medium text-accent-teal mt-0.5">
          {user?.cargo || (user?.role === 'MODERADOR' ? 'Moderador' : user?.role === 'ADMINISTRADOR' ? 'Supervisor' : 'Técnico')}
        </p>
        <p className="text-xs text-light-text-muted dark:text-text-muted mt-1">
          Matrícula: {user?.matricula}
        </p>
      </div>

      {/* Configurações Secundárias */}
      <div className="grid gap-3">
        <button
          onClick={() => setIsConfigOpen(true)}
          className="flex items-center justify-between bg-light-surface dark:bg-surface p-4 rounded-positivo-lg shadow-sm border border-light-border dark:border-border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3 text-light-text-main dark:text-text-main font-medium">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
              <Settings size={20} className="text-light-text-secondary dark:text-text-muted" />
            </div>
            Alterar Foto e Senha
          </div>
        </button>

        <button
          onClick={() => setIsAjudaOpen(true)}
          className="flex items-center justify-between bg-light-surface dark:bg-surface p-4 rounded-positivo-lg shadow-sm border border-light-border dark:border-border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3 text-light-text-main dark:text-text-main font-medium">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
              <HelpCircle size={20} className="text-light-text-secondary dark:text-text-muted" />
            </div>
            Central de Ajuda
          </div>
        </button>
      </div>

      {/* Configurações de Aparência */}
      <div className="bg-light-surface dark:bg-surface p-6 rounded-positivo-lg shadow-sm border border-light-border dark:border-border space-y-4">
        <h3 className="font-semibold text-light-text-main dark:text-text-main">Aparência</h3>
        <p className="text-sm text-light-text-muted dark:text-text-muted">
          Escolha o seu tema preferido para o aplicativo.
        </p>

        {/* Pílula / Segmented Control */}
        <div className="flex bg-slate-100 dark:bg-background rounded-positivo-lg p-1">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`flex-1 flex flex-col items-center justify-center py-2 space-y-1 rounded-positivo-md transition-all duration-200 ${
                  isActive
                    ? 'bg-light-surface dark:bg-surface shadow-sm text-positivo-accent dark:text-primary-DEFAULT font-medium'
                    : 'text-light-text-muted dark:text-text-muted hover:text-light-text-secondary dark:hover:text-text-main'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Botão de Sair */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center space-x-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-positivo-lg transition-colors font-medium"
      >
        <LogOut size={20} />
        <span>Sair da Conta</span>
      </button>

      {/* Modais */}
      <ModalConfiguracoes isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      <ModalAjuda isOpen={isAjudaOpen} onClose={() => setIsAjudaOpen(false)} />
    </div>
  );
}
