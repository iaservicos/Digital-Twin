import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  User, 
  Camera, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Trophy, 
  Medal, 
  Crown, 
  Sparkles, 
  LogOut, 
  Sun, 
  Moon, 
  Monitor, 
  ArrowUpRight, 
  HelpCircle, 
  ShieldCheck, 
  Check, 
  History, 
  ChevronDown, 
  ChevronUp, 
  X 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';
import { useThemeStore, ThemeMode } from '../store/themeStore';
import { useCampanhaStore } from '../store/campanhaStore';
import { api } from '../services/api';
import { toTitleCase, formatLocalEquipe } from '../utils/stringFormatters';
import ModalAjuda from '../components/layout/ModalAjuda';

export default function ProfileScreen() {
  const { user, updateUser, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { campanhas, selectedCampanha, setCampanhas, setSelectedCampanha } = useCampanhaStore();

  const [isAjudaOpen, setIsAjudaOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // 1. ESTADOS DE FOTO DE PERFIL
  // ---------------------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImagem, setPreviewImagem] = useState<string | null>(user?.fotoPerfil || null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [imgFeedback, setImgFeedback] = useState<{ tipo: 'sucesso' | 'erro' | ''; texto: string }>({ tipo: '', texto: '' });

  // ---------------------------------------------------------------------------
  // 2. ESTADOS DE EXPANSÃO (CLICÁVEIS SOB DEMANDA / ACCORDIONS)
  // ---------------------------------------------------------------------------
  const [isSenhaOpen, setIsSenhaOpen] = useState(false);
  const [isCampanhasOpen, setIsCampanhasOpen] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // 3. ESTADOS DE SEGURANÇA / SOLICITAÇÃO DE ALTERAÇÃO DE SENHA
  // ---------------------------------------------------------------------------
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmaSenha, setShowConfirmaSenha] = useState(false);
  const [loadingSenha, setLoadingSenha] = useState(false);
  const [senhaFeedback, setSenhaFeedback] = useState<{ tipo: 'sucesso' | 'erro' | ''; texto: string }>({ tipo: '', texto: '' });

  // ---------------------------------------------------------------------------
  // 4. ESTADOS DE HISTÓRICO DE CAMPANHAS & REVELAÇÃO DO RANKING
  // ---------------------------------------------------------------------------
  const [campanhaAtivaId, setCampanhaAtivaId] = useState<number | null>(null);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingCampanha, setRankingCampanha] = useState<any[]>([]);
  const [rankingError, setRankingError] = useState('');
  const [campanhaDefinidaSucesso, setCampanhaDefinidaSucesso] = useState(false);

  // Identificação do cargo
  const isAdmin = user?.cargo === 'Administrador' || user?.cargo === 'Admin' || user?.cargo === 'Super Administrador';
  const isModerador = ['MODERADOR', 'ROLE_MODERADOR'].includes((user?.role || '').toUpperCase()) || user?.cargo === 'Moderador';
  const isSupervisor = ['SUPERVISOR', 'ROLE_SUPERVISOR', 'ADMINISTRADOR'].includes((user?.role || '').toUpperCase()) || user?.cargo === 'Supervisor' || user?.cargo === 'Supervisor de Campo';

  const themeOptions: { value: ThemeMode; label: string; icon: any }[] = [
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];

  // ---------------------------------------------------------------------------
  // CARREGAR CAMPANHAS AO INICIAR
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const loadCampanhas = async () => {
      try {
        const res = await api.get('/campanha/todas');
        if (isMounted && res.data) {
          setCampanhas(res.data);
        }
      } catch (err) {
        console.error('Erro ao buscar campanhas:', err);
      }
    };
    loadCampanhas();
    return () => { isMounted = false; };
  }, [setCampanhas]);

  // ---------------------------------------------------------------------------
  // REVELAR O RANKING DA CAMPANHA ESCOLHIDA
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!campanhaAtivaId) return;

    let isMounted = true;
    const fetchRankingCampanha = async () => {
      setLoadingRanking(true);
      setRankingError('');
      try {
        const res = await api.get(`/dashboard/ranking?campanhaId=${campanhaAtivaId}`);
        if (isMounted) {
          if (res.data && Array.isArray(res.data)) {
            const normalize = (str: string) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

            const mapped = res.data.map((r: any, idx: number) => {
              const isMe = (user?.nomeCompleto && r.tecnico && normalize(r.tecnico) === normalize(user.nomeCompleto)) ||
                           (user?.matricula && r.matricula && String(r.matricula) === String(user.matricula));
              return {
                id: r.matricula || r.idTecnico || idx,
                name: r.tecnico,
                score: r.pontosTotal || 0,
                base: formatLocalEquipe(r.localEquipe) || 'Base Operacional',
                fotoPerfil: r.fotoPerfil || (isMe ? user?.fotoPerfil : null),
                percentualSla: r.percentualSla || 0,
                percentualReincidenciaEquipe: r.percentualReincidenciaEquipe || 0,
                percentualReincidencia: r.percentualReincidencia || 0,
                percentualPerdidos: r.percentualPerdidos || 0,
                percentualEficienciaPecas: r.percentualEficienciaPecas || 0,
                elegivel: Boolean(r.elegivel),
                isMe: isMe,
                posicaoRanking: r.posicaoRanking || (idx + 1)
              };
            });
            setRankingCampanha(mapped);
          } else {
            setRankingCampanha([]);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Erro ao buscar ranking da campanha:', err);
          setRankingError('Não foi possível carregar os dados de ranking desta campanha.');
        }
      } finally {
        if (isMounted) setLoadingRanking(false);
      }
    };

    fetchRankingCampanha();
    return () => { isMounted = false; };
  }, [campanhaAtivaId, user]);

  // Campanha selecionada no momento
  const campanhaAtual = useMemo(() => {
    return campanhas.find(c => c.idCampanha === campanhaAtivaId) || selectedCampanha;
  }, [campanhas, campanhaAtivaId, selectedCampanha]);

  // Dados do usuário na campanha escolhida
  const myRankingInCampaign = useMemo(() => {
    return rankingCampanha.find(r => r.isMe);
  }, [rankingCampanha]);

  // Top 3 do ranking da campanha escolhida
  const top1 = rankingCampanha[0];
  const top2 = rankingCampanha[1];
  const top3 = rankingCampanha[2];

  // ---------------------------------------------------------------------------
  // INTERAÇÃO AO CLICAR EM UMA CAMPANHA DO HISTÓRICO
  // ---------------------------------------------------------------------------
  const handleSelectCampanha = (id: number) => {
    if (campanhaAtivaId === id) {
      // Se clicar na mesma campanha, alterna a expansão do ranking
      setIsRankingOpen(!isRankingOpen);
    } else {
      // Seleciona a nova campanha e abre o ranking automaticamente
      setCampanhaAtivaId(id);
      setIsRankingOpen(true);
    }
  };

  // ---------------------------------------------------------------------------
  // SALVAR / ALTERAR FOTO
  // ---------------------------------------------------------------------------
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setImgFeedback({ tipo: 'erro', texto: 'A imagem deve ter no máximo 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImagem(reader.result as string);
      setImgFeedback({ tipo: '', texto: '' });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveImage = async () => {
    if (!previewImagem) return;
    setLoadingImg(true);
    setImgFeedback({ tipo: '', texto: '' });
    try {
      await api.put(`/foto-perfil/${user?.matricula}`, { foto: previewImagem });
      await updateUser({ fotoPerfil: previewImagem });
      setImgFeedback({ tipo: 'sucesso', texto: 'Foto de perfil atualizada com sucesso!' });
    } catch (error: any) {
      console.error(error);
      const status = error?.response?.status;
      const msg = status === 413
        ? 'Imagem muito grande. Use uma imagem com no máximo 2MB.'
        : 'Falha ao salvar foto de perfil. Tente novamente.';
      setImgFeedback({ tipo: 'erro', texto: msg });
    } finally {
      setLoadingImg(false);
    }
  };

  // ---------------------------------------------------------------------------
  // SOLICITAR ALTERAÇÃO DE SENHA
  // ---------------------------------------------------------------------------
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaFeedback({ tipo: '', texto: '' });

    if (!novaSenha || novaSenha !== confirmaSenha) {
      setSenhaFeedback({ tipo: 'erro', texto: 'As novas senhas digitadas não coincidem.' });
      return;
    }

    if (novaSenha.length < 5) {
      setSenhaFeedback({ tipo: 'erro', texto: 'A nova senha deve possuir no mínimo 5 caracteres.' });
      return;
    }

    setLoadingSenha(true);
    try {
      if (!isAdmin) {
        try {
          await api.post('/auth/login', {
            matricula: user?.matricula,
            senha: senhaAtual
          });
        } catch {
          setSenhaFeedback({ tipo: 'erro', texto: 'Senha atual incorreta. Caso tenha esquecido, solicite a redefinição ao seu supervisor.' });
          setLoadingSenha(false);
          return;
        }
      }

      await api.post('/auth/change-password', {
        matricula: user?.matricula,
        novaSenha: novaSenha
      });

      setSenhaFeedback({ tipo: 'sucesso', texto: 'Sua senha foi alterada com sucesso!' });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmaSenha('');
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Erro ao alterar senha. Tente novamente.';
      setSenhaFeedback({ tipo: 'erro', texto: msg });
    } finally {
      setLoadingSenha(false);
    }
  };

  // ---------------------------------------------------------------------------
  // DEFINIR COMO CAMPANHA ATIVA DO SISTEMA
  // ---------------------------------------------------------------------------
  const handleDefinirCampanhaAtiva = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (campanhaAtual) {
      setSelectedCampanha(campanhaAtual);
      setCampanhaDefinidaSucesso(true);
      setTimeout(() => setCampanhaDefinidaSucesso(false), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* ======================================================================= */}
      {/* 1. CABEÇALHO DA TELA DE PERFIL                                          */}
      {/* ======================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-light-text-main dark:text-slate-100 tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <User size={24} />
            </span>
            Meu Perfil & Preferências
          </h1>
          <p className="text-xs md:text-sm text-light-text-muted dark:text-slate-400 mt-1">
            Gerencie sua identidade oficial, credenciais de segurança e consulte o histórico de campanhas
          </p>
        </div>

        {/* Botão de Central de Ajuda */}
        <button
          onClick={() => setIsAjudaOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border text-light-text-main dark:text-slate-200 text-xs font-bold hover:border-cyan-500/40 hover:text-cyan-400 transition-all shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <HelpCircle size={16} className="text-cyan-400" />
          Central de Ajuda
        </button>
      </div>

      {/* ======================================================================= */}
      {/* 2. CARD PRINCIPAL (FIXO): HERO DO PERFIL / IDENTIDADE OFICIAL           */}
      {/* ======================================================================= */}
      <div className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] p-6 shadow-xl relative overflow-hidden">
        {/* Luz de fundo decorativa */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Barra superior de status & matrícula */}
        <div className="flex items-center justify-between pb-4 border-b border-light-borderStrong/60 dark:border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <ShieldCheck size={14} /> Credencial Oficial
            </span>
            <span className="hidden sm:inline text-slate-500">•</span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Sessão Conectada
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Matrícula: {user?.matricula || '--'}
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 hover:underline transition-colors cursor-pointer ml-2"
              title="Encerrar sessão com segurança"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sair da Conta</span>
            </button>
          </div>
        </div>

        {/* Conteúdo central: Avatar + Informações do Usuário */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 my-6">
          {/* Avatar com upload */}
          <div 
            className="relative group cursor-pointer shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="Clique para selecionar uma nova foto de perfil"
          >
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-cyan-400/50 shadow-[0_0_25px_rgba(34,211,238,0.2)] flex items-center justify-center bg-slate-900 transition-transform group-hover:scale-105">
              {previewImagem ? (
                <img src={previewImagem} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <User size={46} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
              )}
              {/* Overlay no hover */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full text-white">
                <Camera size={22} className="text-cyan-300" />
                <span className="text-[10px] font-bold mt-1">Alterar Foto</span>
              </div>
            </div>

            <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-cyan-500 text-slate-950 shadow-md border-2 border-slate-900 group-hover:scale-110 transition-transform">
              <Camera size={14} />
            </div>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageChange} 
            accept="image/png, image/jpeg, image/jpg" 
            className="hidden" 
          />

          {/* Dados do Colaborador */}
          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-light-text-main dark:text-slate-100 tracking-tight">
                {toTitleCase(user?.nomeCompleto || 'Colaborador Positivo')}
              </h2>
              <div>
                <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-xs ${
                  isAdmin 
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                    : isModerador 
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    : isSupervisor 
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}>
                  {user?.cargo || (isModerador ? 'Moderador' : isSupervisor ? 'Supervisor' : 'Técnico de Campo')}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Base Operacional: <strong className="text-slate-200">{formatLocalEquipe(user?.localEquipe) || 'Operação Nacional'}</strong>
            </p>

            {/* Feedback de imagem */}
            {imgFeedback.texto && (
              <div className={`mt-3 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                imgFeedback.tipo === 'sucesso' 
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {imgFeedback.tipo === 'sucesso' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{imgFeedback.texto}</span>
              </div>
            )}

            {/* Botão para salvar foto se alterada */}
            {previewImagem && previewImagem !== user?.fotoPerfil && (
              <button
                type="button"
                onClick={handleSaveImage}
                disabled={loadingImg}
                className="mt-3 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {loadingImg ? 'Salvando Foto...' : 'Salvar Nova Foto'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 3. MÓDULO CLICÁVEL 1: SOLICITAR ALTERAÇÃO DE SENHA (EXPANSÍVEL)         */}
      {/* ======================================================================= */}
      <div className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] shadow-xl overflow-hidden transition-all">
        {/* Cabeçalho Clicável */}
        <button
          type="button"
          onClick={() => setIsSenhaOpen(!isSenhaOpen)}
          className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-slate-800/20 transition-colors cursor-pointer group"
          aria-expanded={isSenhaOpen}
        >
          <div className="flex items-center gap-3">
            <span className={`p-2.5 rounded-xl border transition-colors ${
              isSenhaOpen 
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 group-hover:border-cyan-500/40'
            }`}>
              <Lock size={20} />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-light-text-main dark:text-slate-100 tracking-tight flex items-center gap-2">
                Solicitar Alteração de Senha
              </h3>
              <p className="text-xs text-light-text-muted dark:text-slate-400 mt-0.5">
                {isSenhaOpen 
                  ? 'Preencha o formulário abaixo para atualizar sua credencial' 
                  : 'Clique para abrir e atualizar suas credenciais de segurança'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold border border-cyan-500/20">
              AES-256 / SHA
            </span>
            <div className={`p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 transition-transform duration-300 ${isSenhaOpen ? 'rotate-180 text-cyan-400' : ''}`}>
              <ChevronDown size={18} />
            </div>
          </div>
        </button>

        {/* Conteúdo Expansível do Formulário de Senha */}
        {isSenhaOpen && (
          <div className="px-5 pb-6 md:px-6 pt-2 border-t border-light-borderStrong/60 dark:border-border/60 animate-in fade-in slide-in-from-top-2 duration-200">
            <form onSubmit={handleSavePassword} className="space-y-4 mt-3 max-w-2xl">
              
              {/* Senha Atual (apenas para não-administradores) */}
              {!isAdmin && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Senha Atual
                  </label>
                  <div className="relative">
                    <input 
                      type={showSenhaAtual ? 'text' : 'password'}
                      required
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      placeholder="Digite sua senha atual"
                      className="w-full bg-light-background dark:bg-input-bg border border-light-borderStrong dark:border-border text-light-text-main dark:text-slate-100 text-xs font-semibold rounded-xl pl-3.5 pr-10 py-2.5 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showSenhaAtual ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Grid: Nova Senha e Confirmação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input 
                      type={showNovaSenha ? 'text' : 'password'}
                      required
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      placeholder="Mínimo de 5 caracteres"
                      className="w-full bg-light-background dark:bg-input-bg border border-light-borderStrong dark:border-border text-light-text-main dark:text-slate-100 text-xs font-semibold rounded-xl pl-3.5 pr-10 py-2.5 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNovaSenha(!showNovaSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showNovaSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input 
                      type={showConfirmaSenha ? 'text' : 'password'}
                      required
                      value={confirmaSenha}
                      onChange={(e) => setConfirmaSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full bg-light-background dark:bg-input-bg border border-light-borderStrong dark:border-border text-light-text-main dark:text-slate-100 text-xs font-semibold rounded-xl pl-3.5 pr-10 py-2.5 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmaSenha(!showConfirmaSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showConfirmaSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Feedback de sucesso ou erro */}
              {senhaFeedback.texto && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  senhaFeedback.tipo === 'sucesso' 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {senhaFeedback.tipo === 'sucesso' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{senhaFeedback.texto}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={loadingSenha}
                  className="w-full sm:w-auto px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-md hover:shadow-cyan-500/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loadingSenha ? 'Processando Alteração...' : 'Salvar Nova Senha'}
                </button>

                <p className="text-[11px] text-slate-400 text-center sm:text-right">
                  Dúvidas com acesso? Solicite apoio ao gestor de campo.
                </p>
              </div>

            </form>

            <div className="mt-4 pt-3 border-t border-light-borderStrong/60 dark:border-border/60 flex items-start gap-2 text-[11px] text-slate-400">
              <Sparkles size={14} className="text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong>Política de Credenciais:</strong> Sua nova senha tem efeito imediato em todos os dispositivos conectados. Guarde suas credenciais com segurança.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* 4. MÓDULO CLICÁVEL 2: HISTÓRICO DE CAMPANHAS (EXPANSÍVEL)                */}
      {/* ======================================================================= */}
      <div className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] shadow-xl overflow-hidden transition-all">
        {/* Cabeçalho Clicável */}
        <button
          type="button"
          onClick={() => setIsCampanhasOpen(!isCampanhasOpen)}
          className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-slate-800/20 transition-colors cursor-pointer group"
          aria-expanded={isCampanhasOpen}
        >
          <div className="flex items-center gap-3">
            <span className={`p-2.5 rounded-xl border transition-colors ${
              isCampanhasOpen 
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 group-hover:border-cyan-500/40'
            }`}>
              <History size={20} />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-light-text-main dark:text-slate-100 tracking-tight flex items-center gap-2">
                Histórico de Campanhas
              </h3>
              <p className="text-xs text-light-text-muted dark:text-slate-400 mt-0.5">
                {isCampanhasOpen 
                  ? 'Selecione uma campanha abaixo para consultar e revelar o seu ranking correspondente' 
                  : 'Clique para expandir as campanhas registradas no sistema'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
              {campanhas.length} Campanhas
            </span>
            <div className={`p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 transition-transform duration-300 ${isCampanhasOpen ? 'rotate-180 text-cyan-400' : ''}`}>
              <ChevronDown size={18} />
            </div>
          </div>
        </button>

        {/* Conteúdo Expansível: Grid de Campanhas Registradas */}
        {isCampanhasOpen && (
          <div className="px-5 pb-6 md:px-6 pt-3 border-t border-light-borderStrong/60 dark:border-border/60 animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Selecione uma campanha para abrir o ranking oficial:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {campanhas.map((camp) => {
                const isSelected = camp.idCampanha === campanhaAtivaId;
                const dataInicioFormatada = camp.dataInicio ? format(parseISO(camp.dataInicio), 'MMM/yy', { locale: ptBR }) : '';
                const dataFimFormatada = camp.dataFim ? format(parseISO(camp.dataFim), 'MMM/yy', { locale: ptBR }) : '';

                return (
                  <div
                    key={camp.idCampanha}
                    onClick={() => handleSelectCampanha(camp.idCampanha)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between group ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.18)] ring-1 ring-cyan-400/50'
                        : 'bg-light-background dark:bg-input-bg border-light-borderStrong dark:border-border hover:border-slate-600 hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400">
                        Campanha #{camp.idCampanha}
                      </span>
                      {camp.ativa ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Vigente
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                          Encerrada
                        </span>
                      )}
                    </div>

                    <div>
                      <p className={`font-black text-sm capitalize ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                        {dataInicioFormatada} - {dataFimFormatada}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Duração: {camp.duracaoMeses || 2} {camp.duracaoMeses === 1 ? 'mês' : 'meses'}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className={isSelected ? 'text-cyan-400 font-bold flex items-center gap-1' : 'text-slate-400 group-hover:text-slate-200'}>
                        {isSelected ? '● Ranking Selecionado' : 'Clique para ver ranking'}
                      </span>
                      <ArrowUpRight size={13} className={isSelected ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* 5. MÓDULO CLICÁVEL 3: RANKING DA CAMPANHA (SOMENTE SELECIONADA!)        */}
      {/* ======================================================================= */}
      {campanhaAtivaId !== null && (
        <div className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
          
          {/* Cabeçalho Clicável do Ranking com Opção de Fechar e Ocultar */}
          <div 
            onClick={() => setIsRankingOpen(!isRankingOpen)}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 md:p-6 cursor-pointer hover:bg-slate-800/20 transition-colors border-b border-light-borderStrong/60 dark:border-border/60"
          >
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Trophy size={22} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base sm:text-lg font-black text-light-text-main dark:text-slate-100 flex items-center gap-2">
                    Ranking da Campanha:
                    <span className="text-cyan-400">
                      {campanhaAtual?.dataInicio && campanhaAtual?.dataFim
                        ? `${format(parseISO(campanhaAtual.dataInicio), 'MMMM yyyy', { locale: ptBR })} a ${format(parseISO(campanhaAtual.dataFim), 'MMMM yyyy', { locale: ptBR })}`
                        : `Campanha #${campanhaAtivaId}`}
                    </span>
                  </h4>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total de {rankingCampanha.length} colaboradores apurados no período
                </p>
              </div>
            </div>

            {/* Ações e Controles do Ranking */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              {/* Botão de Definir como Campanha Ativa */}
              <button
                type="button"
                onClick={handleDefinirCampanhaAtiva}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  campanhaDefinidaSucesso
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title="Aplica esta campanha para visualização em todo o aplicativo"
              >
                {campanhaDefinidaSucesso ? (
                  <>
                    <Check size={13} /> Campanha Ativada no App
                  </>
                ) : (
                  <>
                    <Calendar size={13} className="text-cyan-400" /> Navegar Nesta Campanha
                  </>
                )}
              </button>

              {/* Botão de Toggle Expansão */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRankingOpen(!isRankingOpen);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {isRankingOpen ? (
                  <>
                    <ChevronUp size={14} className="text-cyan-400" /> Ocultar Ranking
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} className="text-cyan-400" /> Expandir Ranking
                  </>
                )}
              </button>

              {/* Botão para Fechar / Desmarcar Seleção */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCampanhaAtivaId(null);
                  setIsRankingOpen(false);
                }}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                title="Fechar visualização deste ranking"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Conteúdo Expansível do Ranking */}
          {isRankingOpen && (
            <div className="p-5 md:p-6 space-y-6 animate-in fade-in duration-200">
              
              {loadingRanking && (
                <div className="flex items-center justify-center py-8 text-cyan-400 gap-2 text-xs font-bold animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                  Carregando apuração da campanha...
                </div>
              )}

              {rankingError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {rankingError}
                </div>
              )}

              {/* DESTAQUE: COLOCAÇÃO DO USUÁRIO LOGADO NESTA CAMPANHA */}
              {myRankingInCampaign && (
                <div className="bg-gradient-to-r from-cyan-500/15 via-cyan-500/5 to-transparent border-l-4 border-cyan-400 p-4 rounded-r-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-black text-lg shadow-sm">
                      {myRankingInCampaign.posicaoRanking}º
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                        Seu Desempenho Nesta Campanha
                      </span>
                      <p className="text-sm font-bold text-slate-100">
                        {toTitleCase(myRankingInCampaign.name)} • {formatLocalEquipe(myRankingInCampaign.base)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Pontuação Oficial: <strong className="text-cyan-300">{myRankingInCampaign.score.toFixed(1)} pts</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs font-semibold text-slate-300">
                    <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] text-slate-400 block uppercase">SLA</span>
                      <span className="text-cyan-400 font-bold">{myRankingInCampaign.percentualSla.toFixed(1)}%</span>
                    </div>
                    <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] text-slate-400 block uppercase">Reinc. Equipe</span>
                      <span className="text-indigo-400 font-bold">{myRankingInCampaign.percentualReincidenciaEquipe.toFixed(1)}%</span>
                    </div>
                    <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] text-slate-400 block uppercase">Reinc. Indiv.</span>
                      <span className="text-violet-400 font-bold">{myRankingInCampaign.percentualReincidencia.toFixed(1)}%</span>
                    </div>
                    <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] text-slate-400 block uppercase">Perdas</span>
                      <span className="text-amber-400 font-bold">{myRankingInCampaign.percentualPerdidos.toFixed(1)}%</span>
                    </div>
                    <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] text-slate-400 block uppercase">Peças</span>
                      <span className="text-emerald-400 font-bold">{myRankingInCampaign.percentualEficienciaPecas.toFixed(1)}%</span>
                    </div>
                    <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-slate-800 text-center">
                      <span className="text-[9px] text-slate-400 block uppercase">Status</span>
                      <span className={myRankingInCampaign.elegivel ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {myRankingInCampaign.elegivel ? 'Elegível' : 'Inelegível'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* PÓDIO DOS 3 PRIMEIROS LUGARES DA CAMPANHA */}
              <div>
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Medal size={15} className="text-amber-400" /> Pódio Oficial da Campanha Selecionada
                </h5>

                {rankingCampanha.length === 0 && !loadingRanking ? (
                  <p className="text-xs text-slate-400 italic py-4">Nenhum dado de apuração encontrado para esta campanha.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* 2º LUGAR (Prata) */}
                    {top2 && (
                      <div className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-300 bg-slate-800 shrink-0 flex items-center justify-center text-slate-400">
                          {top2.fotoPerfil ? (
                            <img src={top2.fotoPerfil} alt={top2.name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={22} />
                          )}
                        </div>
                        <div className="truncate flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">🥈</span>
                            <p className="font-bold text-xs text-slate-200 truncate">{toTitleCase(top2.name)}</p>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{top2.base}</p>
                          <p className="text-xs font-black text-slate-200 mt-1">
                            {top2.score.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">pts</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 1º LUGAR (Ouro - Campeão) */}
                    {top1 && (
                      <div className="bg-amber-500/10 border-2 border-amber-400/50 rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400 bg-slate-800 shrink-0 flex items-center justify-center text-amber-300 shadow-md">
                          {top1.fotoPerfil ? (
                            <img src={top1.fotoPerfil} alt={top1.name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={26} />
                          )}
                        </div>
                        <div className="truncate flex-1">
                          <div className="flex items-center gap-1.5">
                            <Crown size={15} className="text-amber-400" />
                            <span className="text-base">🥇</span>
                            <p className="font-black text-xs text-amber-300 truncate">{toTitleCase(top1.name)}</p>
                          </div>
                          <p className="text-[11px] text-amber-400/80 truncate">{top1.base}</p>
                          <p className="text-sm font-black text-amber-300 mt-1">
                            {top1.score.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">pts</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 3º LUGAR (Bronze) */}
                    {top3 && (
                      <div className="bg-slate-900/40 border border-orange-500/40 rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-400 bg-slate-800 shrink-0 flex items-center justify-center text-orange-400">
                          {top3.fotoPerfil ? (
                            <img src={top3.fotoPerfil} alt={top3.name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={22} />
                          )}
                        </div>
                        <div className="truncate flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">🥉</span>
                            <p className="font-bold text-xs text-slate-200 truncate">{toTitleCase(top3.name)}</p>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{top3.base}</p>
                          <p className="text-xs font-black text-slate-200 mt-1">
                            {top3.score.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">pts</span>
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* TABELA CONDENSADA COM OS DEMAIS COLABORADORES */}
              {rankingCampanha.length > 3 && (
                <div className="pt-2">
                  <div className="overflow-x-auto rounded-xl border border-light-borderStrong dark:border-border">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-border">
                          <th className="py-2.5 px-3 text-center w-12">#</th>
                          <th className="py-2.5 px-3">Técnico</th>
                          <th className="py-2.5 px-2.5 text-center">Pontos</th>
                          <th className="py-2.5 px-2.5 text-center">SLA</th>
                          <th className="py-2.5 px-2.5 text-center">Reinc. Eq.</th>
                          <th className="py-2.5 px-2.5 text-center">Reinc. Ind.</th>
                          <th className="py-2.5 px-2.5 text-center">Perdas</th>
                          <th className="py-2.5 px-2.5 text-center">Peças</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-slate-300">
                        {rankingCampanha.slice(0, 10).map((r) => (
                          <tr 
                            key={r.id} 
                            className={`hover:bg-cyan-500/5 transition-colors ${r.isMe ? 'bg-cyan-500/10 font-bold' : ''}`}
                          >
                            <td className="py-2 px-3 text-center font-bold text-slate-400">
                              {r.posicaoRanking === 1 ? '🥇' : r.posicaoRanking === 2 ? '🥈' : r.posicaoRanking === 3 ? '🥉' : `${r.posicaoRanking}º`}
                            </td>
                            <td className="py-2 px-3 truncate max-w-xs">
                              <span className={r.isMe ? 'text-cyan-300 font-bold' : 'text-slate-200'}>
                                {toTitleCase(r.name)}
                              </span>
                              <span className="text-[10px] text-slate-400 block">{r.base}</span>
                            </td>
                            <td className="py-2 px-2.5 text-center font-bold text-slate-100">
                              {r.score.toFixed(1)}
                            </td>
                            <td className="py-2 px-2.5 text-center">
                              {r.percentualSla.toFixed(1)}%
                            </td>
                            <td className="py-2 px-2.5 text-center text-indigo-300">
                              {r.percentualReincidenciaEquipe.toFixed(1)}%
                            </td>
                            <td className="py-2 px-2.5 text-center text-violet-300">
                              {r.percentualReincidencia.toFixed(1)}%
                            </td>
                            <td className="py-2 px-2.5 text-center text-amber-300">
                              {r.percentualPerdidos.toFixed(1)}%
                            </td>
                            <td className="py-2 px-2.5 text-center text-emerald-300">
                              {r.percentualEficienciaPecas.toFixed(1)}%
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                r.elegivel ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                              }`}>
                                {r.elegivel ? 'Elegível' : 'Inelegível'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. PREFERÊNCIAS DO SISTEMA (TEMA - APENAS NO MOBILE)                    */}
      {/* ======================================================================= */}
      <div className="block sm:hidden bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] p-5 shadow-xl">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-black text-light-text-main dark:text-slate-100 tracking-tight flex items-center gap-2">
              <Monitor size={16} className="text-cyan-400" />
              Tema & Aparência do Aplicativo
            </h3>
            <p className="text-[11px] text-light-text-muted dark:text-slate-400 mt-0.5">
              Alterne entre modo escuro, claro ou automático
            </p>
          </div>

          {/* Segmented Control */}
          <div className="flex bg-light-background dark:bg-input-bg border border-light-borderStrong dark:border-border rounded-2xl p-1">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon size={13} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de Ajuda */}
      <ModalAjuda isOpen={isAjudaOpen} onClose={() => setIsAjudaOpen(false)} />

    </div>
  );
}
