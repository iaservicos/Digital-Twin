import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import DatabricksSyncFloatingWidget from './DatabricksSyncFloatingWidget';
import InteractiveWaterRippleGrid from './InteractiveWaterRippleGrid';

export default function MainLayout() {
  return (
    <div className="h-screen w-screen overflow-hidden relative font-sans transition-colors flex flex-col lg:flex-row bg-light-background dark:bg-background">
      {/* Background Grid Estático (Dark e Light) */}
      <InteractiveWaterRippleGrid />

      {/* Mobile TopBar: Exibido apenas em telas menores (< lg) */}
      <div className="block lg:hidden relative z-20">
        <TopBar />
      </div>

      {/* Desktop Sidebar: Painel Congelado com Gradiente e scrollbar oculta */}
      <aside className="hidden lg:flex w-64 h-screen flex-shrink-0 flex-col justify-between bg-gradient-to-r from-light-surface to-light-surface-elevated dark:from-surface dark:to-black border-r border-light-borderStrong dark:border-border p-5 z-40 transition-colors overflow-y-auto scrollbar-hide shadow-sidebar dark:shadow-sidebar-dark">
        <DesktopSidebar />
      </aside>

      {/* Área de Conteúdo Principal: Único container de rolagem vertical da aplicação */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden scrollbar-hide pb-28 lg:pb-0 pt-20 lg:pt-0 relative z-10">
        <main className="flex-1 w-full max-w-[105rem] mx-auto p-4 md:p-6 lg:p-8 pb-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <DatabricksSyncFloatingWidget />

      {/* Mobile BottomNav: Exibido apenas em telas menores (< lg) */}
      <div className="block lg:hidden relative z-20">
        <BottomNav />
      </div>
    </div>
  );
}

