import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Trophy,
  Users,
  Settings,
  User,
  Sun,
  Moon,
  LogOut,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { toTitleCase } from '../../utils/stringFormatters';

export const DesktopSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const isAdmin = user?.cargo === 'Administrador' || user?.cargo === 'Admin' || user?.cargo === 'Super Administrador';
  const isModerador = user?.role === 'MODERADOR';
  const isSupervisor = user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR';
  const isTecnico = !isAdmin && !isModerador && !isSupervisor;

  const [tecnicoRank, setTecnicoRank] = React.useState<{ posicao: number | string; pontos: number | null }>({
    posicao: '--',
    pontos: null
  });

  React.useEffect(() => {
    if (!isTecnico || !user?.matricula) return;
    let mounted = true;

    api.get('/dashboard/ranking').then(res => {
      if (mounted && res.data) {
        const normalize = (str: string) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
        const match = res.data.find((r: any) =>
          (r.matricula && String(r.matricula) === String(user.matricula)) ||
          (r.tecnico && user.nomeCompleto && normalize(r.tecnico) === normalize(user.nomeCompleto))
        );
        if (match) {
          setTecnicoRank({
            posicao: match.posicaoRanking,
            pontos: match.pontosTotal
          });
        }
      }
    }).catch(err => {
      console.warn('Erro ao carregar ranking do técnico na sidebar:', err);
    });

    return () => { mounted = false; };
  }, [isTecnico, user?.matricula, user?.nomeCompleto]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="space-y-6">

        {/* 1. Logotipo Oficial Brilha+ (V3) com Linha Divisória e Suporte a Temas */}
        <div className="pb-3.5 border-b border-light-borderStrong dark:border-border">
          <div
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center cursor-pointer group select-none px-1 pt-1"
            title="Brilha+ Início"
          >
            <img
              src={theme === 'light' ? '/Logo/brilha-mais-logo-V3-light.svg' : '/Logo/brilha-mais-logo-V3.svg'}
              alt="Brilha+"
              className="w-full max-w-[165px] h-auto max-h-[35px] object-contain transition-all duration-300 group-hover:scale-105 select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.12)] dark:drop-shadow-glow-primary"
              onError={(e) => {
                (e.target as HTMLImageElement).src = theme === 'light' ? '/Logo/brilha-mais-logo-V3-light.png' : '/Logo/brilha-mais-logo-V3.png';
              }}
            />
          </div>
        </div>

        {/* 2. Card do Usuário Logado */}
        <div className="flex flex-col items-center text-center p-3.5 bg-light-surface-elevated dark:bg-surface-elevated border border-light-border dark:border-border rounded-2xl shadow-sm">
          <div className="w-[62px] h-[62px] rounded-full bg-light-surface dark:bg-surface border-2 border-primary/40 p-0.5 shadow-md mb-2 overflow-hidden flex items-center justify-center">
            {user?.fotoPerfil ? (
              <img src={user.fotoPerfil} alt="Perfil" className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base">
                {user?.nomeCompleto?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <h2 className="text-xs font-bold text-light-text-main dark:text-text-main truncate w-full" title={user?.nomeCompleto}>
            {user?.nomeCompleto ? toTitleCase(user.nomeCompleto) : 'Usuário'}
          </h2>
          <span className="mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">
            {isModerador ? 'Moderador' : isSupervisor ? 'Supervisor' : (user?.cargo || 'Técnico de Campo')}
          </span>
          <button
            onClick={() => navigate('/profile')}
            className="mt-2 text-[10px] text-light-text-muted dark:text-text-muted hover:text-primary transition-colors font-medium cursor-pointer"
          >
            Ver Perfil
          </button>
        </div>

        {/* 3. Menu de Navegação Vertical */}
        <nav className="space-y-1.5">
          {/* Dashboard */}
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${location.pathname === '/dashboard' || location.pathname === '/'
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm shadow-primary/10'
              : 'text-light-text-secondary dark:text-text-muted hover:text-primary hover:bg-light-surface-hover dark:hover:bg-surface-hover'
              }`}
          >
            <LayoutDashboard
              size={18}
              className={
                location.pathname === '/dashboard' ||
                  location.pathname === '/' ? 'text-primary' : 'text-light-text-muted dark:text-text-muted'}
            />
            <span>Dashboard</span>
          </button>

          {/* Ranking */}
          <button
            onClick={() => navigate('/ranking')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${location.pathname === '/ranking'
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm shadow-primary/10'
              : 'text-light-text-secondary dark:text-text-muted hover:text-primary hover:bg-light-surface-hover dark:hover:bg-surface-hover'
              }`}
          >
            <Trophy size={18} className={location.pathname === '/ranking' ? 'text-primary' : 'text-light-text-muted dark:text-text-muted'} />
            <span>Ranking</span>
          </button>

          {/* Supervisão (se Moderador ou Supervisor) */}
          {(isAdmin || isModerador || isSupervisor) && (
            <button
              onClick={() => navigate('/supervisao')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${location.pathname === '/supervisao'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm shadow-primary/10'
                : 'text-light-text-secondary dark:text-text-muted hover:text-primary hover:bg-light-surface-hover dark:hover:bg-surface-hover'
                }`}
            >
              <Users size={18} className={location.pathname === '/supervisao' ? 'text-primary' : 'text-light-text-muted dark:text-text-muted'} />
              <span>Supervisão</span>
            </button>
          )}

          {/* Configurações (se Moderador ou Supervisor) */}
          {(isAdmin || isModerador || isSupervisor) && (
            <button
              onClick={() => navigate('/configuracoes')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${location.pathname === '/configuracoes'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm shadow-primary/10'
                : 'text-light-text-secondary dark:text-text-muted hover:text-primary hover:bg-light-surface-hover dark:hover:bg-surface-hover'
                }`}
            >
              <Settings size={18} className={location.pathname === '/configuracoes' ? 'text-primary' : 'text-light-text-muted dark:text-text-muted'} />
              <span>Configurações</span>
            </button>
          )}

          {/* Perfil */}
          <button
            onClick={() => navigate('/profile')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${location.pathname === '/profile'
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm shadow-primary/10'
              : 'text-light-text-secondary dark:text-text-muted hover:text-primary hover:bg-light-surface-hover dark:hover:bg-surface-hover'
              }`}
          >
            <User size={18} className={location.pathname === '/profile' ? 'text-primary' : 'text-light-text-muted dark:text-text-muted'} />
            <span>Perfil</span>
          </button>

          {/* Widget da Posição do Técnico Logado (Abaixo do botão Perfil) */}
          {isTecnico && (
            <div
              onClick={() => navigate('/ranking')}
              className="mt-3 p-3 rounded-2xl bg-primary/10 border border-primary/30 hover:border-primary/60 transition-all cursor-pointer group shadow-sm"
              title="Clique para ver o Ranking completo"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1.5 text-primary">
                  <Trophy size={13} className="text-amber-400" />
                  Sua Posição
                </span>
                <span className="text-[10px] text-primary group-hover:underline flex items-center gap-0.5">
                  Ver <ArrowUpRight size={11} />
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg font-black text-light-text-main dark:text-text-main tracking-tight">
                  {tecnicoRank.posicao !== '--' ? `${tecnicoRank.posicao}º Lugar` : '--'}
                </span>
                {tecnicoRank.pontos !== null && (
                  <span className="text-xs font-bold text-primary">
                    {tecnicoRank.pontos.toFixed(1)} <span className="text-[10px] text-light-text-muted dark:text-text-muted font-normal">pts</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* 4. Rodapé da Sidebar: Logo Positivo (acima da linha) + Linha Divisória + Sair e Toggle Tema */}
      <div className="space-y-3">
        {/* Logotipo Positivo Tecnologia Oficial (tamanho aumentado para destaque e nitidez) */}
        <div className="flex items-center justify-center px-2 py-1.5">
          <img
            src="/Logo/positivo_tecnologia.png"
            alt="Positivo Tecnologia"
            className="h-14 w-auto max-w-[200px] object-contain dark:filter-none filter brightness-0 dark:brightness-100 opacity-95 hover:opacity-100 transition-all select-none"
          />
        </div>

        {/* Linha Divisória e Ações */}
        <div className="pt-3 border-t border-light-borderStrong dark:border-border space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-light-text-muted dark:text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>

          <div className="flex items-center justify-between px-2 pt-0.5">
            <span className={`text-[10px] font-bold ${theme === 'light' ? 'text-primary font-extrabold' : 'text-light-text-muted dark:text-text-muted'}`}>Light</span>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-11 h-5 bg-slate-200 dark:bg-surface-hover rounded-full p-0.5 border border-light-borderStrong dark:border-border flex items-center transition-colors cursor-pointer relative"
              title="Alternar Tema"
            >
              <div
                className={`w-4 h-4 rounded-full bg-primary flex items-center justify-center text-slate-950 transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                  }`}
              >
                {theme === 'dark' ? <Moon size={10} /> : <Sun size={10} />}
              </div>
            </button>
            <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-primary font-extrabold' : 'text-light-text-muted dark:text-text-muted'}`}>Dark</span>
          </div>
        </div>
      </div>
    </div>
  );
};
