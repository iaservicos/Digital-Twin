import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from '../components/layout/MainLayout';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RankingScreen from '../screens/RankingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { token, isLoading } = useAuthStore();

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

  // Verifica as roles se `allowedRoles` for fornecido
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = useAuthStore.getState().user?.role || 'PADRAO';
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

const RootRedirect = () => {
  const { user } = useAuthStore();
  const isElevated = user?.role === 'MODERADOR' || user?.role === 'ADMINISTRADOR' || user?.cargo === 'Administrador' || user?.cargo === 'Super Administrador';
  
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

      {/* Rota Privada sem Layout (Onboarding) */}
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingScreen /></ProtectedRoute>} />

      {/* Rotas Privadas (Com o MainLayout) */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/ranking" element={<RankingScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={['MODERADOR']}><SettingsScreen /></ProtectedRoute>} />
        {/* JSDoc: Administradores e Moderadores têm acesso à Supervisão */}
        <Route path="/supervisao" element={<ProtectedRoute allowedRoles={['MODERADOR', 'ADMINISTRADOR']}><AdminDashboardScreen /></ProtectedRoute>} />
      </Route>

      {/* Redirecionamento padrão para rotas não encontradas */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
