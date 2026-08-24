import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { Award, Target, Trophy, ChevronRight, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const [step, setStep] = useState(0);

  // States para mudança de senha
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (newPassword.length < 5) {
      setError('A senha deve ter no mínimo 5 caracteres.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/change-password', {
        matricula: user?.matricula,
        novaSenha: newPassword
      });

      // Atualiza estado global para primeiroAcesso = false
      await updateUser({ primeiroAcesso: false });
      
      setLoading(false);
      setStep(2); // Vai para o tutorial gamificado
    } catch (err: any) {
      setLoading(false);
      setError(err.response?.data?.message || 'Erro ao alterar a senha. Tente novamente.');
    }
  };

  const handleFinish = () => {
    if (user?.role === 'MODERADOR' || user?.role === 'ADMINISTRADOR' || user?.cargo === 'Administrador') {
      navigate('/supervisao');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-grid-pattern text-text-main p-4 overflow-hidden relative">
      
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-accent-teal/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-brilhamais-gold/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-2xl w-full z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="bg-light-surface/10 backdrop-blur-xl border border-white/20 p-10 rounded-3xl text-center shadow-2xl">
            <div className="mx-auto w-24 h-24 bg-light-surface rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
              <img src="/Logo/positivo.svg" alt="Positivo" width={120} height={48} className="h-12 w-auto" />
            </div>
            <h1 className="text-4xl font-black mb-4">Bem-vindo(a) ao<br/><span className="text-brilhamais-gold">Brilha Mais!</span></h1>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              Olá, <strong className="text-text-main">{user?.nomeCompleto}</strong>! Este é o programa de reconhecimento e premiação da Positivo. Estamos muito felizes em ter você aqui.
            </p>
            <button 
              onClick={() => setStep(1)}
              className="bg-brilhamais-gold hover:bg-yellow-500 text-light-text-main font-bold text-lg px-8 py-4 rounded-full transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(250,204,21,0.4)] flex items-center justify-center w-full md:w-auto mx-auto"
            >
              Começar <ChevronRight className="ml-2" />
            </button>
          </div>
        )}

        {/* Step 1: Change Password */}
        {step === 1 && (
          <div className="bg-light-surface/10 backdrop-blur-xl border border-white/20 p-10 rounded-3xl shadow-2xl animate-in slide-in-from-right-8 duration-500">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-accent-teal/20 text-accent-teal rounded-full flex items-center justify-center">
                <Lock size={32} />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-center mb-2">Segurança em 1º lugar</h2>
            <p className="text-light-text-muted text-center mb-8">
              Como este é seu primeiro acesso, precisamos que você defina uma nova senha pessoal e intransferível.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl text-center mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-5 max-w-sm mx-auto">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Nova Senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full bg-background/50 border border-border text-text-main rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent transition-colors placeholder:text-light-text-muted"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-light-text-muted hover:text-text-main transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Confirme a Nova Senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full bg-background/50 border border-border text-text-main rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent transition-colors placeholder:text-light-text-muted"
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-accent-teal hover:bg-emerald-400 text-light-text-main font-bold text-lg px-8 py-4 rounded-xl transition-colors hover:shadow-[0_0_20px_rgba(0,216,166,0.4)] disabled:opacity-50 mt-4"
              >
                {loading ? 'Salvando...' : 'Salvar e Continuar'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Como funciona */}
        {step === 2 && (
          <div className="bg-light-surface/10 backdrop-blur-xl border border-white/20 p-8 md:p-12 rounded-3xl shadow-2xl animate-in slide-in-from-right-8 duration-500">
            <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center">
              <Target className="mr-3 text-brilhamais-gold" size={32}/> Como funciona a pontuação?
            </h2>
            
            <div className="space-y-6">
              <div className="bg-background/40 p-5 rounded-2xl border border-border flex gap-4 items-start hover:bg-background/60 transition-colors">
                <div className="bg-blue-500/20 text-blue-400 p-3 rounded-xl shrink-0">
                  <span className="font-black text-xl">100</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main mb-1">Você começa com 100 pontos</h3>
                  <p className="text-light-text-muted text-sm leading-relaxed">Todo mês, você inicia com a nota máxima de 100 pontos de SLA e Reincidência. O seu objetivo é manter essa nota alta finalizando seus chamados dentro do prazo e com qualidade.</p>
                </div>
              </div>

              <div className="bg-background/40 p-5 rounded-2xl border border-border flex gap-4 items-start hover:bg-background/60 transition-colors">
                <div className="bg-accent-teal/20 text-accent-teal p-3 rounded-xl shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main mb-1">Métricas que Deduzem Pontos</h3>
                  <p className="text-light-text-muted text-sm leading-relaxed">Chamados Fora do SLA, Reincidências (até 3 meses) e Perdas de Performance reduzem sua nota gradativamente. Mantenha as taxas baixas!</p>
                </div>
              </div>

              <div className="bg-background/40 p-5 rounded-2xl border border-border flex gap-4 items-start hover:bg-background/60 transition-colors">
                <div className="bg-brilhamais-gold/20 text-brilhamais-gold p-3 rounded-xl shrink-0">
                  <Award size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main mb-1">Bônus Adicionais</h3>
                  <p className="text-light-text-muted text-sm leading-relaxed">Avaliações NPS positivas de clientes (Promotores) e baixa utilização desnecessária de peças adicionam pontos extras valiosos à sua média!</p>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-end">
              <button 
                onClick={() => setStep(3)}
                className="bg-light-surface hover:bg-slate-200 text-light-text-main font-bold px-8 py-3 rounded-full transition-colors flex items-center"
              >
                Próximo <ChevronRight className="ml-1" size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Finish */}
        {step === 3 && (
          <div className="bg-gradient-to-br from-brilhamais-gold/20 to-brilhamais-gold/5 backdrop-blur-xl border border-brilhamais-gold/30 p-10 md:p-14 rounded-3xl text-center shadow-2xl animate-in slide-in-from-right-8 duration-500">
            <div className="mx-auto w-24 h-24 bg-brilhamais-gold text-light-text-main rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(250,204,21,0.5)]">
              <Trophy size={48} />
            </div>
            <h2 className="text-4xl font-black mb-4 text-text-main">Tudo Pronto!</h2>
            <p className="text-brilhamais-gold/80 text-lg mb-8 font-medium">
              Agora você já conhece as regras para conquistar seu lugar no ranking de premiações.
            </p>
            
            <button 
              onClick={handleFinish}
              className="bg-brilhamais-gold hover:bg-yellow-400 text-light-text-main font-bold text-xl px-10 py-5 rounded-2xl transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(250,204,21,0.5)] w-full flex items-center justify-center uppercase tracking-wider"
            >
              Ir para o Meu Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
