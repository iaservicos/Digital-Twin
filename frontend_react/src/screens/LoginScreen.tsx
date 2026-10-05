import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import { User, Lock, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { validatePassword, SENHA_PADRAO_SISTEMA } from '../utils/passwordValidator';
import IntroSplashOverlay from '../components/common/IntroSplashOverlay';
import MatrixBackground from '../components/common/MatrixBackground';

interface PrimeiroAcessoData {
  accessToken: string;
  matricula: string;
  nome: string;
  cargo?: string;
  localEquipe?: string;
  role?: string;
}

export default function LoginScreen() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estados do fluxo de Primeiro Acesso
  const [primeiroAcessoData, setPrimeiroAcessoData] = useState<PrimeiroAcessoData | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [trocaLoading, setTrocaLoading] = useState(false);
  const [trocaError, setTrocaError] = useState('');

  const passwordValidation = useMemo(() => validatePassword(novaSenha), [novaSenha]);
  const isDifferentFromDefault = Boolean(
    novaSenha &&
    novaSenha !== SENHA_PADRAO_SISTEMA &&
    novaSenha !== 'Brilha123' &&
    novaSenha !== 'brilha123'
  );
  const isMatching = Boolean(novaSenha && confirmaSenha && novaSenha === confirmaSenha);

  // Controle de reprodução da intro do vídeo BrilhaMaisV7.mp4 na abertura do site
  const [showIntro, setShowIntro] = useState(() => {
    return sessionStorage.getItem('brilha_intro_seen') !== 'true';
  });

  const redirecionarPorPerfil = (role?: string, cargo?: string) => {
    if (role === 'MODERADOR' || role === 'ADMINISTRADOR' || role === 'SUPERVISOR' || cargo === 'Administrador' || cargo === 'Super Administrador' || cargo === 'Supervisor de Campo') {
      navigate('/supervisao');
    } else {
      navigate('/dashboard');
    }
  };

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

      const { accessToken, nome, cargo, localEquipe, role, primeiroAcesso } = response.data;
      const decoded: any = jwtDecode(accessToken);
      const nomeFinal = nome || decoded.nome || decoded.sub || userIdInput;

      // Se for primeiro acesso, exibe o modal obrigatório de troca de senha
      if (primeiroAcesso) {
        setPrimeiroAcessoData({
          accessToken,
          matricula: userIdInput,
          nome: nomeFinal,
          cargo,
          localEquipe,
          role
        });
        setLoading(false);
        return;
      }

      await setAuth(accessToken, {
        matricula: userIdInput,
        primeiroAcesso: false,
        nomeCompleto: nomeFinal,
        cargo: cargo,
        localEquipe: localEquipe,
        role: role
      });

      setLoading(false);
      redirecionarPorPerfil(role, cargo);
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

  const handleTrocaSenhaPrimeiroAcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primeiroAcessoData) return;

    setTrocaError('');
    if (!passwordValidation.isValid) {
      setTrocaError(passwordValidation.errors[0] || 'A nova senha não atende aos requisitos mínimos.');
      return;
    }
    if (!isDifferentFromDefault) {
      setTrocaError('Por segurança, sua nova senha não pode ser igual à senha provisória inicial.');
      return;
    }
    if (!isMatching) {
      setTrocaError('As senhas digitadas não coincidem.');
      return;
    }

    setTrocaLoading(true);
    try {
      await api.post(
        '/auth/change-password',
        {
          novaSenha: novaSenha,
          matricula: primeiroAcessoData.matricula
        },
        {
          headers: {
            Authorization: `Bearer ${primeiroAcessoData.accessToken}`
          }
        }
      );

      // Conclui o login na aplicação
      await setAuth(primeiroAcessoData.accessToken, {
        matricula: primeiroAcessoData.matricula,
        primeiroAcesso: false,
        nomeCompleto: primeiroAcessoData.nome,
        cargo: primeiroAcessoData.cargo,
        localEquipe: primeiroAcessoData.localEquipe,
        role: primeiroAcessoData.role
      });

      setTrocaLoading(false);
      redirecionarPorPerfil(primeiroAcessoData.role, primeiroAcessoData.cargo);
    } catch (err: any) {
      setTrocaLoading(false);
      setTrocaError(err.response?.data?.detail || err.response?.data?.message || 'Falha ao alterar senha.');
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

      {/* Modal Obrigatório de Primeiro Acesso: Troca de Senha */}
      {primeiroAcessoData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-bento border border-primary/40 rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Glow decorativo de fundo */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-3 shadow-inner">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-xl font-bold text-light-text-main dark:text-text-main">
                Primeiro Acesso ao Brilha+
              </h2>
              <p className="text-xs text-light-text-muted dark:text-text-muted mt-1 max-w-xs leading-relaxed">
                Olá, <strong className="text-light-text-main dark:text-text-main">{primeiroAcessoData.nome}</strong>! Por segurança operacional, cadastre sua nova senha pessoal antes de continuar.
              </p>
            </div>

            {trocaError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs font-medium text-center mb-4">
                {trocaError}
              </div>
            )}

            <form onSubmit={handleTrocaSenhaPrimeiroAcesso} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[0.6875rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider pl-1">
                  Nova Senha Pessoal
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none" />
                  <input
                    type={showNovaSenha ? "text" : "password"}
                    required
                    minLength={6}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    className="w-full glass-bento border border-light-border dark:border-white/10 text-light-text-main dark:text-text-main rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-light-text-muted/60 dark:placeholder:text-text-muted/60 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted hover:text-primary transition-colors cursor-pointer"
                  >
                    {showNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[0.6875rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider pl-1">
                  Confirmação da Nova Senha
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none" />
                  <input
                    type={showNovaSenha ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                    className="w-full glass-bento border border-light-border dark:border-white/10 text-light-text-main dark:text-text-main rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-light-text-muted/60 dark:placeholder:text-text-muted/60 shadow-inner"
                  />
                </div>
              </div>

              {/* Dicas de validação */}
              <div className="bg-light-surface-elevated/40 dark:bg-white/5 rounded-xl p-3 border border-light-border/40 dark:border-white/5 text-[0.6875rem] space-y-1.5 text-light-text-muted dark:text-text-muted">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasMinLength ? 'text-emerald-500 font-semibold' : ''}`}>
                    <CheckCircle2 size={13} className={passwordValidation.hasMinLength ? 'text-emerald-500' : 'opacity-40'} />
                    <span>Pelo menos 8 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasUpperCase ? 'text-emerald-500 font-semibold' : ''}`}>
                    <CheckCircle2 size={13} className={passwordValidation.hasUpperCase ? 'text-emerald-500' : 'opacity-40'} />
                    <span>Letra maiúscula (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasLowerCase ? 'text-emerald-500 font-semibold' : ''}`}>
                    <CheckCircle2 size={13} className={passwordValidation.hasLowerCase ? 'text-emerald-500' : 'opacity-40'} />
                    <span>Letra minúscula (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasNumber ? 'text-emerald-500 font-semibold' : ''}`}>
                    <CheckCircle2 size={13} className={passwordValidation.hasNumber ? 'text-emerald-500' : 'opacity-40'} />
                    <span>Número (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordValidation.hasSpecialChar ? 'text-emerald-500 font-semibold' : ''}`}>
                    <CheckCircle2 size={13} className={passwordValidation.hasSpecialChar ? 'text-emerald-500' : 'opacity-40'} />
                    <span>Caractere especial (!@#$...)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isDifferentFromDefault ? 'text-emerald-500 font-semibold' : ''}`}>
                    <CheckCircle2 size={13} className={isDifferentFromDefault ? 'text-emerald-500' : 'opacity-40'} />
                    <span>Diferente da senha inicial</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 pt-1 border-t border-light-border/40 dark:border-white/5 ${isMatching ? 'text-emerald-500 font-semibold' : ''}`}>
                  <CheckCircle2 size={13} className={isMatching ? 'text-emerald-500' : 'opacity-40'} />
                  <span>Senhas idênticas</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={trocaLoading}
                  className="w-full flex items-center justify-center py-3.5 px-6 rounded-xl font-bold text-sm bg-primary text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer tracking-wider"
                >
                  {trocaLoading ? 'Salvando...' : 'Salvar Nova Senha & Entrar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrimeiroAcessoData(null);
                    setNovaSenha('');
                    setConfirmaSenha('');
                    setTrocaError('');
                  }}
                  className="text-xs text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main py-1 transition-colors cursor-pointer text-center"
                >
                  Cancelar e voltar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
