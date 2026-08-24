import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Sun, Moon, Bell, User, Settings, LogOut, Home, Users, HelpCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import ModalConfiguracoes from './ModalConfiguracoes';
import ModalAjuda from './ModalAjuda';
import { toTitleCase } from '../../utils/stringFormatters';
import { useCampanhaStore, Campanha } from '../../store/campanhaStore';

export default function TopBar() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAjudaOpen, setIsAjudaOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { campanhas, selectedCampanha, setCampanhas, setSelectedCampanha } = useCampanhaStore();

  useEffect(() => {
    const fetchCampanhas = async () => {
      try {
        const res = await api.get('/campanha/todas');
        setCampanhas(res.data);
        // Só define a ativa se não houver nenhuma campanha selecionada no storage
        if (!useCampanhaStore.getState().selectedCampanha && res.data.length > 0) {
          const ativa = res.data.find((c: Campanha) => c.ativa);
          setSelectedCampanha(ativa || res.data[0]);
        }
      } catch (error) {
        console.error('Erro ao buscar campanhas', error);
      }
    };
    fetchCampanhas();
  }, [setCampanhas, setSelectedCampanha]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buscar foto de perfil ao montar
  useEffect(() => {
    const fetchFoto = async () => {
      // Busca se não tiver foto em memória ou se só tiver o marcador (foto está no servidor)
      if (user?.matricula && (!user.fotoPerfil || user.fotoPerfil === '__HAS_FOTO__')) {
        try {
          const res = await api.get(`/foto-perfil/${user.matricula}`);
          useAuthStore.setState((state) => ({
            user: state.user ? { ...state.user, fotoPerfil: res.data.foto || undefined } : null,
          }));
        } catch {
          console.log('Sem foto de perfil ou erro ao buscar.');
          useAuthStore.setState((state) => ({
            user: state.user ? { ...state.user, fotoPerfil: undefined } : null,
          }));
        }
      }
    };
    fetchFoto();
  }, [user?.matricula]);

  const isAdmin = user?.cargo === 'Administrador' || user?.cargo === 'Admin' || user?.cargo === 'Super Administrador';
  const isModerador = user?.role === 'MODERADOR';
  const isSupervisor = user?.role === 'ADMINISTRADOR';

  return (
    <header className="fixed top-0 left-0 right-0 bg-light-surface dark:bg-background shadow-sm border-b border-light-borderStrong dark:border-border z-40 h-20 flex items-center justify-between px-6 pt-safe">

      {/* Esquerda: Logo */}
      <div className="flex items-center">
        <img src="/Logo/positivo.svg" alt="Positivo Brilha Mais" className="h-16 md:h-28 object-contain" />
      </div>

      {/* Meio: Logo Brilha+ Centralizado */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex items-baseline cursor-pointer hover:opacity-100 transition-all duration-300 select-none z-10 group"
        onClick={() => navigate(isAdmin || isModerador || isSupervisor ? '/supervisao' : '/dashboard')}
        style={{ fontFamily: "'Arial Black', Impact, sans-serif", letterSpacing: "-0.05em" }}
        title="Voltar para o Início"
      >
        <h1 className="text-2xl font-black text-light-text-main dark:text-text-main uppercase transition-all duration-300 group-hover:text-[#0891b2] group-hover:drop-shadow-[0_0_8px_rgba(8,145,178,0.8)]">
          Brilha<span className="text-3xl text-[#0891b2] ml-[1px] leading-none">+</span>
        </h1>
      </div>

      {/* Direita: Ações e Perfil */}
      <div className="flex items-center space-x-4 md:space-x-6">

        {/* Toggle de Tema */}
        <button
          onClick={toggleTheme}
          className="hidden md:block p-2 rounded-full text-light-text-muted hover:text-light-text-secondary dark:text-text-muted dark:hover:text-text-main transition-colors"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notificações */}
        <button className="relative p-2 rounded-full text-light-text-muted hover:text-light-text-secondary dark:text-text-muted dark:hover:text-text-main transition-colors">
          <Bell size={20} />
          {/* Badge vermelho de notificação */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Separador */}
        <div className="hidden md:block w-px h-8 bg-slate-200 dark:bg-border"></div>

        {/* Perfil do Usuário com Dropdown */}
        <div className="relative" ref={menuRef}>
          <div 
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-light-text-main dark:text-text-main leading-tight">
                {user?.nomeCompleto ? toTitleCase(user.nomeCompleto) : 'Usuário'}
              </span>
              <span className="text-xs text-accent-teal font-medium">
                {user?.cargo || (isModerador ? 'Moderador' : isSupervisor ? 'Supervisor' : 'Técnico')}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-surface border border-light-borderStrong dark:border-border flex items-center justify-center text-light-text-muted dark:text-text-muted hover:bg-slate-200 transition-colors overflow-hidden">
              {user?.fotoPerfil ? (
                <img src={user.fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <User size={20} />
              )}
            </div>
          </div>

          {/* Menu Dropdown */}
          {isMenuOpen && (
            <div className="hidden md:block absolute right-0 mt-2 w-48 bg-light-surface dark:bg-surface rounded-md shadow-lg py-1 border border-light-borderStrong dark:border-border z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-light-borderStrong dark:border-border mb-1">
                <p className="text-sm font-bold text-light-text-main dark:text-text-main truncate" title={user?.nomeCompleto}>{toTitleCase(user?.nomeCompleto)}</p>
                <p className="text-xs text-light-text-muted dark:text-text-muted truncate" title={user?.localEquipe}>{user?.localEquipe || 'Localidade não informada'}</p>
              </div>
              {/* JSDoc: Administradores e Moderadores têm acesso ao Painel de Supervisão */}
              {location.pathname === '/configuracoes' && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate('/supervisao');
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-light-text-secondary dark:text-text-main bg-transparent hover:text-[#0891b2] dark:hover:text-[#0891b2] transition-colors duration-200"
                >
                  <Users size={16} className="mr-2" />
                  Painel de Supervisão
                </button>
              )}

              {isModerador && location.pathname === '/supervisao' && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate('/configuracoes');
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-light-text-secondary dark:text-text-main bg-transparent hover:text-[#0891b2] dark:hover:text-[#0891b2] transition-colors duration-200"
                >
                  <Settings size={16} className="mr-2" />
                  Painel do Moderador
                </button>
              )}

              {/* Separador */}
              {((location.pathname === '/configuracoes') || (isModerador && location.pathname === '/supervisao')) && (
                <div className="h-px bg-light-borderStrong dark:bg-border my-1 mx-2"></div>
              )}

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsConfigOpen(true);
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-light-text-secondary dark:text-text-main bg-transparent hover:text-[#0891b2] dark:hover:text-[#0891b2] transition-colors duration-200"
              >
                <Settings size={16} className="mr-2" />
                Configurações
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsAjudaOpen(true);
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-light-text-secondary dark:text-text-main bg-transparent hover:text-[#0891b2] dark:hover:text-[#0891b2] transition-colors duration-200"
              >
                <HelpCircle size={16} className="mr-2" />
                Ajuda
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 bg-transparent hover:text-red-500 dark:hover:text-red-500 transition-colors duration-200 mt-1"
              >
                <LogOut size={16} className="mr-2" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      <ModalConfiguracoes isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      <ModalAjuda isOpen={isAjudaOpen} onClose={() => setIsAjudaOpen(false)} />
    </header>
  );
}
