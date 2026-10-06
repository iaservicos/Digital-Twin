import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { 
  Target, 
  Trophy, 
  ArrowRight, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  Clock, 
  AlertTriangle, 
  Award,
  Package,
  Layers,
  ChevronLeft
} from 'lucide-react';
import { validatePassword, SENHA_PADRAO_SISTEMA } from '../utils/passwordValidator';
import MatrixBackground from '../components/common/MatrixBackground';

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const [step, setStep] = useState(0);

  // States para redefinição de senha
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Validação em tempo real com as regras de complexidade
  const passwordValidation = useMemo(() => validatePassword(novaSenha), [novaSenha]);
  const isDifferentFromDefault = Boolean(
    novaSenha &&
    novaSenha !== SENHA_PADRAO_SISTEMA &&
    novaSenha !== 'Brilha123' &&
    novaSenha !== 'brilha123' &&
    novaSenha !== 'Brilha@123'
  );
  const isMatching = Boolean(novaSenha && confirmaSenha && novaSenha === confirmaSenha);
  const isFormValid = passwordValidation.isValid && isDifferentFromDefault && isMatching;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0] || 'A nova senha não atende aos requisitos mínimos.');
      return;
    }

    if (!isDifferentFromDefault) {
      setError('Por segurança, sua nova senha não pode ser igual à senha provisória inicial.');
      return;
    }

    if (!isMatching) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/auth/change-password', {
        matricula: user?.matricula,
        novaSenha: novaSenha
      });

      setLoading(false);
      setStep(2); // Avança para o passo explicativo de pontuação e regras
    } catch (err: any) {
      setLoading(false);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Erro ao alterar a senha. Tente novamente.');
    }
  };

  const handleFinish = async () => {
    try {
      // Conclui o primeiro acesso atualizando o perfil local
      await updateUser({ primeiroAcesso: false });
    } catch (err) {
      console.error('Erro ao atualizar primeiro acesso:', err);
    }

    const isElevated = user?.role === 'MODERADOR' || user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERVISOR' || user?.cargo === 'Administrador' || user?.cargo === 'Super Administrador' || user?.cargo === 'Supervisor de Campo';
    if (isElevated) {
      navigate('/supervisao', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const stepsLabels = [
    'Boas-Vindas',
    'Segurança',
    'Como Funciona',
    'Tudo Pronto'
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-light-background dark:bg-background text-light-text-main dark:text-text-main p-4 sm:p-6 overflow-x-hidden relative font-sans">
      {/* Fundo Matrix Cibernético sutil */}
      <MatrixBackground opacity={0.15} fontSize={11} />

      {/* Glows de ambientação nas extremidades */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Container Central com Glassmorphism */}
      <div className="max-w-2xl w-full z-10 animate-in fade-in slide-in-from-bottom-6 duration-500 my-auto">
        
        {/* Barra de Progresso Superior */}
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex justify-between items-center px-1 text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
            <span>Passo {step + 1} de {stepsLabels.length}</span>
            <span className="text-primary font-bold">{stepsLabels[step]}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {stepsLabels.map((label, idx) => (
              <div 
                key={label}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx <= step ? 'bg-primary shadow-sm shadow-primary/40' : 'bg-light-border dark:bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ============================================================== */}
        {/* PASSO 0: BOAS-VINDAS AO BRILHA+ */}
        {/* ============================================================== */}
        {step === 0 && (
          <div className="glass-bento border border-primary/30 rounded-3xl p-6 sm:p-10 text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Glow interno decorativo */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

            <div className="mx-auto flex items-center justify-center gap-3 mb-6">
              <img 
                src="/Logo/positivo_tecnologia.png" 
                alt="Positivo Tecnologia" 
                className="h-8 w-auto object-contain dark:brightness-100 brightness-0 opacity-90"
              />
            </div>

            <div className="flex justify-center mb-4">
              <img
                src="/Logo/brilha-mais-logo-V3.svg"
                alt="Brilha+ Logo"
                className="w-48 sm:w-64 h-auto object-contain drop-shadow-glow-primary"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/Logo/brilha-mais-logo-V3-trimmed.png';
                }}
              />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-light-text-main dark:text-text-main mb-3">
              Bem-vindo(a) ao <span className="text-primary">Brilha+</span>! 🌟
            </h1>

            <p className="text-sm sm:text-base text-light-text-secondary dark:text-text-muted mb-6 leading-relaxed max-w-lg mx-auto">
              Olá, <strong className="text-light-text-main dark:text-text-main">{user?.nomeCompleto || user?.matricula || 'Colaborador'}</strong>! 
              Este é o seu portal oficial de performance, metas e reconhecimento da Positivo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
              <div className="bg-light-surface-elevated/40 dark:bg-white/5 border border-light-border/60 dark:border-white/5 p-3.5 rounded-2xl flex flex-col gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Target size={18} />
                </div>
                <h2 className="text-xs font-bold text-light-text-main dark:text-text-main">Metas em Tempo Real</h2>
                <p className="text-[11px] text-light-text-muted dark:text-text-muted leading-tight">
                  Acompanhe seus indicadores de SLA e Reincidência dia a dia.
                </p>
              </div>

              <div className="bg-light-surface-elevated/40 dark:bg-white/5 border border-light-border/60 dark:border-white/5 p-3.5 rounded-2xl flex flex-col gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Award size={18} />
                </div>
                <h2 className="text-xs font-bold text-light-text-main dark:text-text-main">Premiações Mensais</h2>
                <p className="text-[11px] text-light-text-muted dark:text-text-muted leading-tight">
                  Bata as metas operacionais e conquiste premiações exclusivas.
                </p>
              </div>

              <div className="bg-light-surface-elevated/40 dark:bg-white/5 border border-light-border/60 dark:border-white/5 p-3.5 rounded-2xl flex flex-col gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Sparkles size={18} />
                </div>
                <h2 className="text-xs font-bold text-light-text-main dark:text-text-main">Transparência Total</h2>
                <p className="text-[11px] text-light-text-muted dark:text-text-muted leading-tight">
                  Histórico completo de chamados e critérios de cálculo abertos.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-primary text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span>Iniciar Primeiro Acesso</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASSO 1: SEGURANÇA EM 1º LUGAR (NOVA SENHA PESSOAL) */}
        {/* ============================================================== */}
        {step === 1 && (
          <div className="glass-bento border border-primary/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 mb-6 text-light-text-muted dark:text-text-muted">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="hover:text-light-text-main dark:hover:text-text-main flex items-center gap-1 text-xs font-semibold cursor-pointer transition-colors"
              >
                <ChevronLeft size={16} /> Voltar
              </button>
            </div>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-3 shadow-inner">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-light-text-main dark:text-text-main">
                Segurança em 1º Lugar
              </h2>
              <p className="text-xs sm:text-sm text-light-text-secondary dark:text-text-muted mt-1 max-w-md leading-relaxed">
                Como este é o seu primeiro acesso ao Brilha+, cadastre sua nova senha pessoal e intransferível antes de continuar.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-3.5 rounded-xl text-xs font-medium text-center mb-5">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md mx-auto">
              <div className="space-y-1">
                <label className="text-[0.6875rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider pl-1">
                  Nova Senha Pessoal
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none" />
                  <input
                    type={showNovaSenha ? "text" : "password"}
                    required
                    minLength={8}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
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
                    minLength={8}
                    value={confirmaSenha}
                    onChange={(e) => setConfirmaSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                    className="w-full glass-bento border border-light-border dark:border-white/10 text-light-text-main dark:text-text-main rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-light-text-muted/60 dark:placeholder:text-text-muted/60 shadow-inner"
                  />
                </div>
              </div>

              {/* Checklist de Validação Dinâmica */}
              <div className="bg-light-surface-elevated/40 dark:bg-white/5 rounded-xl p-3.5 border border-light-border/40 dark:border-white/5 text-[0.6875rem] space-y-1.5 text-light-text-muted dark:text-text-muted">
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
                    <span>Diferente da provisória</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 pt-1.5 border-t border-light-border/40 dark:border-white/5 ${isMatching ? 'text-emerald-500 font-semibold' : ''}`}>
                  <CheckCircle2 size={13} className={isMatching ? 'text-emerald-500' : 'opacity-40'} />
                  <span>Senhas idênticas</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="w-full flex items-center justify-center py-3.5 px-6 rounded-xl font-bold text-sm bg-primary text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wider"
                >
                  {loading ? 'Salvando...' : 'Salvar Nova Senha & Continuar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASSO 2: COMO FUNCIONA A PONTUAÇÃO? (REGRAS E METAS) */}
        {/* ============================================================== */}
        {step === 2 && (
          <div className="glass-bento border border-primary/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-3 shadow-inner">
                <Target size={28} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-light-text-main dark:text-text-main">
                Como Funciona a Pontuação?
              </h2>
              <p className="text-xs sm:text-sm text-light-text-secondary dark:text-text-muted mt-1 max-w-md leading-relaxed">
                Conheça os pilares essenciais para manter sua nota alta e disputar o ranking de premiação.
              </p>
            </div>

            <div className="space-y-3.5 mb-8">
              {/* Card 100 Pontos Iniciais */}
              <div className="bg-light-surface-elevated/40 dark:bg-white/5 border border-light-border/50 dark:border-white/5 p-4 rounded-2xl flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20 flex items-center justify-center font-black text-sm shrink-0">
                  100
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-light-text-main dark:text-text-main">
                    Você Inicia com Nota Máxima
                  </h3>
                  <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5 leading-relaxed">
                    Todo início de mês você começa com 100 pontos garantidos de SLA e Reincidência. O seu objetivo é preservar essa pontuação com atendimentos de alta qualidade.
                  </p>
                </div>
              </div>

              {/* Card SLA On-site */}
              <div className="bg-light-surface-elevated/40 dark:bg-white/5 border border-light-border/50 dark:border-white/5 p-4 rounded-2xl flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-light-text-main dark:text-text-main">
                    SLA de Atendimento (Meta On-site &gt; 90%)
                  </h3>
                  <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5 leading-relaxed">
                    Finalize seus chamados rigorosamente dentro do prazo. Chamados com estouro de SLA geram deduções progressivas na sua nota mensal.
                  </p>
                </div>
              </div>

              {/* Card Reincidência */}
              <div className="bg-light-surface-elevated/40 dark:bg-white/5 border border-light-border/50 dark:border-white/5 p-4 rounded-2xl flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-light-text-main dark:text-text-main">
                    Reincidência Operacional (Meta &lt; 7%)
                  </h3>
                  <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5 leading-relaxed">
                    Evite que o mesmo equipamento volte a abrir chamado nos últimos 90 dias. Um reparo bem feito na primeira visita protege sua pontuação.
                  </p>
                </div>
              </div>

              {/* Card Uso Consciente de Peças */}
              <div className="bg-light-surface-elevated/40 dark:bg-white/5 border border-light-border/50 dark:border-white/5 p-4 rounded-2xl flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-light-text-main dark:text-text-main">
                    Uso Consciente de Peças
                  </h3>
                  <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5 leading-relaxed">
                    O técnico não recebe pontos a mais por economizar peças: o diagnóstico assertivo e a aplicação correta de sobressalentes evitam desperdícios e deduções, preservando também a sua pontuação intacta.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-primary text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span>Próximo Passo</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASSO 3: TUDO PRONTO! (CONCLUSÃO E ACESSO AO DASHBOARD) */}
        {/* ============================================================== */}
        {step === 3 && (
          <div className="glass-bento border border-primary/40 rounded-3xl p-6 sm:p-12 text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Glow comemorativo de fundo */}
            <div className="absolute -top-20 -right-20 w-56 h-56 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mb-6 shadow-[0_0_35px_rgba(95,149,152,0.3)] animate-pulse">
              <Trophy size={42} />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-light-text-main dark:text-text-main mb-3">
              Tudo Pronto para Brilhar! 🚀
            </h2>

            <p className="text-sm sm:text-base text-light-text-secondary dark:text-text-muted mb-8 max-w-md mx-auto leading-relaxed">
              Sua nova senha foi salva com segurança e você já conhece os critérios de apuração.
              Agora, acompanhe seus números e busque o topo do ranking!
            </p>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full sm:w-auto px-10 py-4 rounded-xl font-black text-sm sm:text-base bg-primary text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-2 mx-auto cursor-pointer uppercase tracking-wider"
            >
              <span>Acessar Meu Painel</span>
              <ArrowRight size={20} />
            </button>
          </div>
        )}

      </div>

      {/* Rodapé discreto com opção de Sair */}
      <div className="mt-6 z-10 text-center">
        <button
          type="button"
          onClick={logout}
          className="text-xs text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main transition-colors cursor-pointer"
        >
          Deseja entrar com outra conta? <span className="underline">Sair</span>
        </button>
      </div>
    </div>
  );
}
