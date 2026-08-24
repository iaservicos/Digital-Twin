import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import DatabricksSyncFloatingWidget from './DatabricksSyncFloatingWidget';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-light-background dark:bg-grid-pattern font-sans pb-16 md:pb-0 pt-20 transition-colors">
      <TopBar />
      <main className="flex-1 overflow-y-auto max-w-md md:max-w-7xl mx-auto w-full p-4 md:p-8 relative">
        <Outlet />
      </main>
      <DatabricksSyncFloatingWidget />
      <BottomNav />
    </div>
  );
}
