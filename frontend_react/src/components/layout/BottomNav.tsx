import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Trophy, User, Settings, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import ModalConfiguracoes from './ModalConfiguracoes';

type NavItem = {
  path?: string;
  action?: 'config';
  icon: any;
  label: string;
};

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuthStore();
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const isAdmin = user?.cargo === 'Administrador' || user?.cargo === 'Admin' || user?.cargo === 'Super Administrador';
  const isModerador = user?.role === 'MODERADOR';
  const isSupervisor = user?.role === 'ADMINISTRADOR'; // Nota: Na arquitetura atual, role ADMINISTRADOR age como Supervisor.

  // Montagem dinâmica dos itens da barra
  let navItems: NavItem[] = [];

  if (isAdmin || isModerador) {
    // Admin/Moderador
    navItems = [
      { path: '/supervisao', icon: Users, label: 'Supervisionar' },
      { action: 'config', icon: Settings, label: 'Configurações' },
      { path: '/profile', icon: User, label: 'Perfil' }
    ];
  } else if (isSupervisor) {
    // Supervisor
    navItems = [
      { path: '/supervisao', icon: Users, label: 'Supervisionar' },
      { path: '/profile', icon: User, label: 'Perfil' }
    ];
  } else {
    // Técnico
    navItems = [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/profile', icon: User, label: 'Perfil' }
    ];
  }

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-light-surface dark:bg-background border-t border-light-borderStrong dark:border-border pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
          {navItems.map((item, idx) => {
            const isActive = item.path ? location.pathname === item.path : false;
            const Icon = item.icon;
            
            if (item.action === 'config') {
              return (
                <button
                  key={`action-${idx}`}
                  onClick={() => setIsConfigOpen(true)}
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                    isConfigOpen ? 'text-accent-teal' : 'text-light-text-muted hover:text-slate-600'
                  }`}
                >
                  <Icon size={24} strokeWidth={isConfigOpen ? 2.5 : 2} />
                  <span className={`text-[10px] font-medium ${isConfigOpen ? 'font-semibold' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.path || idx}
                to={item.path!}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-brilhamais-gold' : 'text-light-text-muted hover:text-slate-600'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <ModalConfiguracoes isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
    </>
  );
}
