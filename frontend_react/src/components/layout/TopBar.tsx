import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { 
  Sun, 
  Moon, 
  Bell, 
  User
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import ModalConfiguracoes from './ModalConfiguracoes';
import ModalAjuda from './ModalAjuda';
import { toTitleCase } from '../../utils/stringFormatters';
import { useCampanhaStore, Campanha } from '../../store/campanhaStore';

export default function TopBar() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAjudaOpen, setIsAjudaOpen] = useState(false);
  const { campanhas, selectedCampanha, setCampanhas, setSelectedCampanha } = useCampanhaStore();

  useEffect(() => {
    const fetchCampanhas = async () => {
      try {
        const res = await api.get('/campanha/todas');
        setCampanhas(res.data);
        // Atualiza para a campanha ativa se não houver seleção ou se a selecionada estiver inativa
        const currentStored = useCampanhaStore.getState().selectedCampanha;
        if ((!currentStored || !currentStored.ativa || !res.data.some((c: Campanha) => c.idCampanha === currentStored.idCampanha)) && res.data.length > 0) {
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
  const isSupervisor = user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR';

  // Identificação das Views Contextuais
  const isViewModerador = location.pathname.startsWith('/configuracoes');
  const isViewSupervisao = location.pathname.startsWith('/supervisao');

  return (
    <header className="fixed top-0 left-0 right-0 bg-light-surface dark:bg-background shadow-sm border-b border-light-borderStrong dark:border-border z-40 h-20 flex items-center justify-between px-3 sm:px-6 pt-safe">

      {/* Esquerda: Logo */}
      <div className="flex items-center">
        <img 
          src="/Logo/positivo_tecnologia.png" 
          alt="Positivo Tecnologia" 
          className="h-8 sm:h-12 md:h-16 w-auto max-w-[100px] sm:max-w-none object-contain dark:filter-none filter brightness-0 dark:brightness-100 transition-all duration-200" 
        />
      </div>

      {/* Meio: Logo Brilha+ Centralizado */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex items-baseline cursor-pointer hover:opacity-100 transition-all duration-300 select-none z-10 group"
        onClick={() => navigate(isAdmin || isModerador || isSupervisor ? '/supervisao' : '/dashboard')}
        style={{ fontFamily: "'Montserrat', 'Montserrat Black', sans-serif", fontWeight: 900, letterSpacing: "-0.05em" }}
        title="Voltar para o Início"
      >
        <h1 className="text-xl sm:text-2xl font-black text-light-text-main dark:text-text-main uppercase transition-all duration-300 group-hover:text-primary group-hover:drop-shadow-glow-primary">
          Brilha<span className="text-2xl sm:text-3xl text-primary ml-[1px] leading-none">+</span>
        </h1>
      </div>

      {/* Direita: Ações e Perfil */}
      <div className="flex items-center space-x-2 sm:space-x-4 md:space-x-6">

        {/* Toggle de Tema (Acessível em Mobile e Desktop) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-full text-light-text-muted hover:text-light-text-secondary dark:text-text-muted dark:hover:text-text-main transition-colors cursor-pointer"
          title="Alternar Tema Claro / Escuro"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notificações */}
        <button 
          type="button"
          className="relative p-2 rounded-full text-light-text-muted hover:text-light-text-secondary dark:text-text-muted dark:hover:text-text-main transition-colors cursor-pointer"
        >
          <Bell size={20} />
          {/* Badge vermelho de notificação */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Separador */}
        <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-border"></div>

        {/* Perfil do Usuário: Navega diretamente para a tela de Perfil */}
        <div 
          className="flex items-center space-x-2 sm:space-x-3 cursor-pointer select-none group"
          onClick={() => navigate('/profile')}
          title="Ver Meu Perfil"
        >
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-bold text-light-text-main dark:text-text-main leading-tight group-hover:text-primary transition-colors">
              {user?.nomeCompleto ? toTitleCase(user.nomeCompleto) : 'Usuário'}
            </span>
            <span className="text-xs text-accent-teal font-medium">
              {user?.cargo || (isModerador ? 'Moderador' : isSupervisor ? 'Supervisor' : 'Técnico')}
            </span>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-surface border border-light-borderStrong dark:border-border flex items-center justify-center text-light-text-muted dark:text-text-muted hover:bg-slate-200 group-hover:border-primary transition-all overflow-hidden shadow-xs">
            {user?.fotoPerfil ? (
              <img src={user.fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
            ) : (
              <User size={18} />
            )}
          </div>
        </div>
      </div>

      <ModalConfiguracoes isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      <ModalAjuda isOpen={isAjudaOpen} onClose={() => setIsAjudaOpen(false)} />
    </header>
  );
}
