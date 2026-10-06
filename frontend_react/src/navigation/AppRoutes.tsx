import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from '../components/layout/MainLayout';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RankingScreen from '../screens/RankingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  allowFirstAccess?: boolean;
}

const ProtectedRoute = ({ children, allowedRoles, allowFirstAccess = false }: ProtectedRouteProps) => {
  const { token, user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-light-background dark:bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-teal"></div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Se o usuário possui primeiro acesso pendente e a rota atual não permite primeiro acesso, força o onboarding
  if (user?.primeiroAcesso && !allowFirstAccess) {
    return <Navigate to="/onboarding" replace />;
  }

  // Se o usuário já concluiu o primeiro acesso e tenta acessar o onboarding diretamente, redireciona ao painel
  if (!user?.primeiroAcesso && allowFirstAccess) {
    const isElevated = user?.role === 'MODERADOR' || user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR' || user?.cargo === 'Administrador' || user?.cargo === 'Super Administrador' || user?.cargo === 'Supervisor de Campo';
    return <Navigate to={isElevated ? "/supervisao" : "/dashboard"} replace />;
  }

  // Verifica as roles se `allowedRoles` for fornecido
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (user?.role || 'PADRAO').toUpperCase();
    const userCargo = (user?.cargo || '').toLowerCase();

    const isAllowed = allowedRoles.some((r) => {
      const target = r.toUpperCase();
      if (userRole === target || userRole.includes(target)) return true;
      if (target === 'SUPERVISOR' && userCargo.includes('supervisor')) return true;
      if ((target === 'ADMINISTRADOR' || target === 'ADMIN') && userCargo.includes('admin')) return true;
      if (target === 'MODERADOR' && userCargo.includes('moderador')) return true;
      return false;
    });

    if (!isAllowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

const RootRedirect = () => {
  const { user } = useAuthStore();

  if (user?.primeiroAcesso) {
    return <Navigate to="/onboarding" replace />;
  }

  const isElevated = user?.role === 'MODERADOR' || user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR' || user?.cargo === 'Administrador' || user?.cargo === 'Super Administrador' || user?.cargo === 'Supervisor de Campo';
  
  if (isElevated) {
    return <Navigate to="/supervisao" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export default function AppRoutes() {
  return (
    <Routes>
      {/* Rotas Públicas */}
      <Route path="/login" element={<LoginScreen />} />

      {/* Rota Privada sem Layout (Tela de Boas-Vindas e Primeiro Acesso) */}
      <Route path="/onboarding" element={<ProtectedRoute allowFirstAccess><OnboardingScreen /></ProtectedRoute>} />

      {/* Rotas Privadas (Com o MainLayout) */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardScreen />} />
        {/* Ranking blindado: somente moderadores, administradores e supervisores */}
        <Route path="/ranking" element={<ProtectedRoute allowedRoles={['MODERADOR', 'ADMINISTRADOR', 'SUPERVISOR', 'ADMIN']}><RankingScreen /></ProtectedRoute>} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={['MODERADOR', 'ADMINISTRADOR', 'SUPERVISOR', 'ADMIN']}><SettingsScreen /></ProtectedRoute>} />
        {/* JSDoc: Administradores, Moderadores e Supervisores têm acesso à Supervisão */}
        <Route path="/supervisao" element={<ProtectedRoute allowedRoles={['MODERADOR', 'ADMINISTRADOR', 'SUPERVISOR', 'ADMIN']}><AdminDashboardScreen /></ProtectedRoute>} />
      </Route>

      {/* Redirecionamento padrão para rotas não encontradas */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
