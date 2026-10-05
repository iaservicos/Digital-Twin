import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LucideIcon, LayoutDashboard, Trophy, User, Settings, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import ModalConfiguracoes from './ModalConfiguracoes';

type NavItem = {
  path?: string;
  action?: 'config';
  icon: LucideIcon;
  label: string;
};

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuthStore();
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const isAdmin = user?.cargo === 'Administrador' || user?.cargo === 'Admin' || user?.cargo === 'Super Administrador';
  const isModerador = ['MODERADOR', 'ROLE_MODERADOR'].includes((user?.role || '').toUpperCase()) || user?.cargo === 'Moderador';
  const isSupervisor = ['SUPERVISOR', 'ROLE_SUPERVISOR', 'ADMINISTRADOR'].includes((user?.role || '').toUpperCase()) || user?.cargo === 'Supervisor' || user?.cargo === 'Supervisor de Campo';
  const isGestor = isAdmin || isModerador || isSupervisor;

  // Montagem dinâmica dos itens da barra por perfil de acesso
  const navItems: NavItem[] = isGestor
    ? [
        { path: '/supervisao', icon: Users, label: 'Supervisão' },
        { path: '/ranking', icon: Trophy, label: 'Ranking' },
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/configuracoes', icon: Settings, label: 'Gestão' },
        { path: '/profile', icon: User, label: 'Perfil' }
      ]
    : [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/ranking', icon: Trophy, label: 'Ranking' },
        { path: '/profile', icon: User, label: 'Perfil' }
      ];

  return (
    <>
      <nav className="block lg:hidden fixed bottom-0 left-0 right-0 bg-light-surface/95 dark:bg-background/95 backdrop-blur-md border-t border-light-borderStrong dark:border-border pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.35)] z-40 transition-colors">
        <div className={`grid ${isGestor ? 'grid-cols-5' : 'grid-cols-3'} items-center w-full max-w-lg mx-auto px-1 pt-1.5 pb-1`}>
          {navItems.map((item, idx) => {
            const isActive = item.path ? location.pathname === item.path : false;
            const Icon = item.icon;
            
            if (item.action === 'config') {
              return (
                <button
                  key={`action-${idx}`}
                  type="button"
                  onClick={() => setIsConfigOpen(true)}
                  className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer ${
                    isConfigOpen
                      ? 'text-primary font-bold'
                      : 'text-light-text-muted dark:text-text-muted hover:text-primary'
                  }`}
                >
                  <div className={`p-1.5 rounded-full transition-all ${
                    isConfigOpen ? 'bg-primary/10 shadow-xs' : 'hover:bg-primary/5'
                  }`}>
                    <Icon size={20} strokeWidth={isConfigOpen ? 2.5 : 2} />
                  </div>
                  <span className={`text-[10px] tracking-tight leading-none mt-1 truncate max-w-full text-center ${isConfigOpen ? 'font-black' : 'font-medium'}`}>
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.path || idx}
                to={item.path!}
                className={`flex flex-col items-center justify-center py-1 transition-all group ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-light-text-muted dark:text-text-muted hover:text-primary'
                }`}
              >
                <div className={`p-1.5 rounded-full transition-all ${
                  isActive ? 'bg-primary/10 shadow-xs' : 'group-hover:bg-primary/5'
                }`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] tracking-tight leading-none mt-1 truncate max-w-full text-center ${isActive ? 'font-black' : 'font-medium'}`}>
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
