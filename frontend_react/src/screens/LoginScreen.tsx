import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import { User, ShieldCheck } from 'lucide-react';

export default function LoginScreen() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados do Modal de Primeiro Acesso
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [primeiroAcessoStep, setPrimeiroAcessoStep] = useState<1 | 2>(1);
  const [paNome, setPaNome] = useState('');
  const [paEstado, setPaEstado] = useState('');
  const [paMatricula, setPaMatricula] = useState('');
  const [paLoading, setPaLoading] = useState(false);
  const [paError, setPaError] = useState('');
  const [tecnicoId, setTecnicoId] = useState<number | null>(null);

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

      const { accessToken, primeiroAcesso, nome, cargo, localEquipe, role } = response.data;
      const decoded: any = jwtDecode(accessToken);

      await setAuth(accessToken, {
        matricula: userIdInput,
        primeiroAcesso: primeiroAcesso,
        nomeCompleto: nome || decoded.nome || decoded.sub || userIdInput,
        cargo: cargo,
        localEquipe: localEquipe,
        role: role
      });

      setLoading(false);

      if (primeiroAcesso) {
        navigate('/onboarding');
      } else {
        if (role === 'MODERADOR' || role === 'ADMINISTRADOR' || cargo === 'Administrador' || cargo === 'Super Administrador') {
          navigate('/supervisao');
        } else {
          navigate('/dashboard');
        }
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

  const handleVerificarTecnico = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaError('');

    if (paMatricula.length !== 5) {
      setPaError('Matrícula inválida');
      return;
    }

    setPaLoading(true);
    try {
      const response = await api.post('/auth/verificar-tecnico', {
        nome: paNome,
        estado: paEstado
      });
      setTecnicoId(response.data.id);
      setPrimeiroAcessoStep(2);
    } catch (err: any) {
      setPaError('O Nome ou Estado divergente. Procure seu gestor.');
    } finally {
      setPaLoading(false);
    }
  };

  const handleConfirmarMatricula = async () => {
    setPaError('');
    setPaLoading(true);
    try {
      const response = await api.post('/auth/vincular-matricula', {
        id: tecnicoId,
        matricula: paMatricula
      });

      const { accessToken, primeiroAcesso, nome, cargo, localEquipe, role } = response.data;
      const decoded: any = jwtDecode(accessToken);

      await setAuth(accessToken, {
        matricula: paMatricula,
        primeiroAcesso: primeiroAcesso,
        nomeCompleto: nome || decoded.nome || decoded.sub || paNome,
        cargo: cargo,
        localEquipe: localEquipe,
        role: role
      });

      setIsModalOpen(false);
      navigate('/onboarding');
    } catch (err: any) {
      setPaError('Erro ao vincular matrícula. Tente novamente.');
    } finally {
      setPaLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 py-12 px-4 sm:px-6 lg:px-8 bg-grid-pattern">

      {/* Coluna Esquerda: Logo */}
      <div className="flex flex-col items-center">
        <div className="logo-container flex items-center justify-center relative pt-2 pb-2">
          <div className="glow-ring"></div>
          <h1 className="text-5xl font-black tracking-tighter text-slate-50 flex items-baseline relative z-10 uppercase" style={{ fontFamily: "'Arial Black', Impact, sans-serif", letterSpacing: "-0.05em" }}>
            Brilha<span className="text-6xl plus-sign neon-glow ml-1 leading-none text-accent-teal">+</span>
          </h1>
        </div>
        <div className="mt-1 text-center">
          <p className="text-primary font-bold tracking-[0.3em] uppercase text-xs opacity-80">
            Performance & Engajamento
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
          <div>
            <label htmlFor="userId" className="sr-only">Matrícula</label>
            <input
              id="userId"
              name="userId"
              type="text"
              required
              autoComplete="username"
              className="dark-autofill w-full bg-[#0f172a] border border-[#1e293b] text-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent-teal focus:border-accent-teal transition-all placeholder:text-text-muted text-sm shadow-inner"
              placeholder="Matrícula"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="dark-autofill w-full bg-[#0f172a] border border-[#1e293b] text-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent-teal focus:border-accent-teal transition-all placeholder:text-text-muted text-sm shadow-inner"
              placeholder="Senha"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-[#0f172a] bg-accent-teal hover:bg-primary-light focus:outline-none transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Autenticando...' : 'Entrar'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(true);
                setPrimeiroAcessoStep(1);
                setPaError('');
                setPaNome('');
                setPaEstado('');
                setPaMatricula('');
              }}
              className="text-sm font-bold text-accent-teal hover:text-primary-light transition-colors"
            >
              Primeiro acesso? Clique aqui!
            </button>
          </div>
        </form>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-grid-pattern">
          <div className="w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#1e293b] p-8 rounded-2xl shadow-2xl border border-border">

              <div className="flex items-center justify-center mb-6">
                <div className="w-14 h-14 bg-accent-teal/5 text-accent-teal rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,216,166,0.15)] ring-1 ring-accent-teal/20">
                  {primeiroAcessoStep === 1 ? <User size={26} strokeWidth={2.5} /> : <ShieldCheck size={26} />}
                </div>
              </div>

              <h3 className="text-2xl font-light text-center text-text-main mb-2">Primeiro Acesso</h3>
              <p className="text-text-muted text-center mb-8 text-sm px-2">
                {primeiroAcessoStep === 1
                  ? "Para iniciar seu cadastro, preencha seus dados de identificação abaixo."
                  : "Quase lá! Confirme se a sua matrícula está correta."}
              </p>

              {paError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-xl text-center mb-6 text-sm">
                  {paError}
                </div>
              )}

              {primeiroAcessoStep === 1 ? (
                <form onSubmit={handleVerificarTecnico} className="space-y-4">
                  <div>
                    <input
                      id="paNome"
                      type="text"
                      required
                      value={paNome}
                      onChange={e => setPaNome(e.target.value)}
                      className="dark-autofill w-full bg-[#0f172a] border border-[#1e293b] text-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent-teal focus:border-accent-teal transition-all placeholder:text-text-muted text-sm shadow-inner"
                      placeholder="Nome Completo"
                    />
                  </div>
                  <div>
                    <input
                      id="paEstado"
                      type="text"
                      required
                      value={paEstado}
                      onChange={e => setPaEstado(e.target.value)}
                      className="dark-autofill w-full bg-[#0f172a] border border-[#1e293b] text-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent-teal focus:border-accent-teal transition-all placeholder:text-text-muted text-sm"
                      placeholder="Estado (Ex: RJ)"
                    />
                  </div>
                  <div>
                    <input
                      id="paMatricula"
                      type="text"
                      required
                      value={paMatricula}
                      onChange={e => setPaMatricula(e.target.value)}
                      className="dark-autofill w-full bg-[#0f172a] border border-[#1e293b] text-slate-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent-teal focus:border-accent-teal transition-all placeholder:text-text-muted text-sm"
                      placeholder="Matrícula (Exatamente 5 dígitos)"
                    />
                  </div>

                  <div className="flex gap-4 mt-8 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-4 py-3.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-xl transition-all font-semibold text-sm shadow-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={paLoading}
                      className="flex-1 px-4 py-3.5 bg-accent-teal hover:bg-primary-light text-[#0f172a] rounded-xl transition-all font-bold text-sm disabled:opacity-50 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] shadow-md"
                    >
                      {paLoading ? 'Verificando...' : 'Continuar'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6 text-center">
                  <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6">
                    <p className="text-text-muted text-sm mb-2 font-medium">Sua Matrícula</p>
                    <p className="text-3xl font-black text-text-main tracking-widest">{paMatricula}</p>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button
                      type="button"
                      onClick={() => setPrimeiroAcessoStep(1)}
                      className="flex-1 px-4 py-3.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-xl transition-all font-semibold text-sm shadow-sm"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmarMatricula}
                      disabled={paLoading}
                      className="flex-1 px-4 py-3.5 bg-accent-teal hover:bg-primary-light text-[#0f172a] rounded-xl transition-all font-bold text-sm disabled:opacity-50 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] shadow-md"
                    >
                      {paLoading ? 'Salvando...' : 'Confirmar e Salvar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
