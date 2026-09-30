import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import IntroSplashOverlay from '../components/common/IntroSplashOverlay';
import MatrixBackground from '../components/common/MatrixBackground';

export default function LoginScreen() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Controle de reprodução da intro do vídeo BrilhaMaisV7.mp4 na abertura do site
  const [showIntro, setShowIntro] = useState(() => {
    return sessionStorage.getItem('brilha_intro_seen') !== 'true';
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = e.target as HTMLFormElement;
    const userIdInput = (form.elements.namedItem('userId') as HTMLInputElement).value;
    const passwordInput = (form.elements.namedItem('password') as HTMLInputElement).value;

    try {
      const response = await api.post('/auth/login', {
        matricula: userIdInput,
        senha: passwordInput
      });

      const { accessToken, nome, cargo, localEquipe, role } = response.data;
      const decoded: any = jwtDecode(accessToken);

      await setAuth(accessToken, {
        matricula: userIdInput,
        primeiroAcesso: false,
        nomeCompleto: nome || decoded.nome || decoded.sub || userIdInput,
        cargo: cargo,
        localEquipe: localEquipe,
        role: role
      });

      setLoading(false);

      if (role === 'MODERADOR' || role === 'ADMINISTRADOR' || role === 'SUPERVISOR' || cargo === 'Administrador' || cargo === 'Super Administrador' || cargo === 'Supervisor de Campo') {
        navigate('/supervisao');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setLoading(false);
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('O servidor está inicializando (Cold Start). Por favor, aguarde alguns segundos e clique em Entrar novamente.');
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.status === 401) {
        setError('ID ou Senha inválidos. Verifique suas credenciais.');
      } else if (!err.response) {
        setError('Falha de conexão com o servidor. Verifique sua rede e tente novamente.');
      } else {
        setError(err.response?.data?.message || 'Erro ao realizar login. Verifique suas credenciais.');
      }
      console.error('Erro de login:', err);
    }
  };

  return (
    <>
      {/* Reprodução do Vídeo na abertura inicial com transição cinematográfica */}
      {showIntro && (
        <IntroSplashOverlay onFinish={() => setShowIntro(false)} />
      )}

      {/* Plano de Fundo Matrix Cyber Ciano Procedural (40% de opacidade, caracteres pequenos) */}
      <MatrixBackground opacity={0.2} fontSize={10} />

      <div className="relative z-10 min-h-screen w-full flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 py-12 px-4 sm:px-6 lg:px-8">

        <div className="flex flex-col items-center">
          <div className="animate-float flex items-center justify-center relative pt-2 pb-2">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-primary/20 blur-2xl z-0 pointer-events-none" />
            <img
              src="/Logo/brilha-mais-logo-V3.svg"
              alt="Brilha+ Logo"
              className="w-[260px] sm:w-[320px] md:w-[400px] lg:w-[440px] h-auto object-contain relative z-10 drop-shadow-glow-primary select-none pointer-events-none"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/Logo/brilha-mais-logo-V3-trimmed.png';
              }}
            />
          </div>
          <div className="mt-2 text-center">
            <p className="text-primary font-bold tracking-[0.3em] uppercase text-xs opacity-80">
              Performance &amp; Engajamento
            </p>
          </div>
        </div>

        {/* Coluna Direita: Formulário */}
        <div className="w-full max-w-sm flex flex-col z-10">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-xl text-center text-sm font-medium shadow-sm mb-6">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="relative">
              <label htmlFor="userId" className="sr-only">Matrícula</label>
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none" />
              <input
                id="userId"
                name="userId"
                type="text"
                required
                autoComplete="username"
                className="dark-autofill w-full glass-bento border border-light-border dark:border-white/10 text-light-text-main dark:text-text-main rounded-full pl-11 pr-4 py-3.5 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-light-text-muted dark:placeholder:text-text-muted text-sm shadow-inner"
                placeholder="Matrícula"
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">Senha</label>
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="dark-autofill w-full glass-bento border border-light-border dark:border-white/10 text-light-text-main dark:text-text-main rounded-full pl-11 pr-11 py-3.5 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-light-text-muted dark:placeholder:text-text-muted text-sm shadow-inner"
                placeholder="Senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted hover:text-primary transition-colors cursor-pointer"
                title={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 px-6 border border-primary/40 text-sm font-bold rounded-full text-slate-950 bg-primary hover:brightness-110 active:scale-[0.98] focus:outline-none transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer tracking-wider"
              >
                {loading ? 'Autenticando...' : 'Entrar'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
