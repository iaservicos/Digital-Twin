import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Calendar, Check, X, PowerOff, Plus, Settings, Clock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';
import { EditCampaignModal } from '../modals/EditCampaignModal';

export default function CampaignManager() {
  const { token, user } = useAuthStore();
  const { tracker, triggerCampaignRecalculation } = useSyncStore();

  const [isEncerrarModalOpen, setIsEncerrarModalOpen] = useState(false);
  const [isNovaCampanhaModalOpen, setIsNovaCampanhaModalOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [duracaoMeses, setDuracaoMeses] = useState<number>(1);
  const [limparDadosBrutos, setLimparDadosBrutos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [campanhaAtual, setCampanhaAtual] = useState<{dataInicio: string, dataFim: string, duracaoMeses: number} | null>(null);
  const [isEditCampaignOpen, setIsEditCampaignOpen] = useState(false);

  // Validação de Perfil: Apenas Moderadores podem editar regras ou gerenciar campanhas
  const isModerador = user?.role === 'MODERADOR' || user?.cargo === 'Moderador';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const formatDuration = (totalSeconds: number): string => {
    const s = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  useEffect(() => {
    fetchCampanhaAtual();
  }, []);

  const fetchCampanhaAtual = async () => {
    try {
      const response = await api.get('/campanha/ativa');
      setCampanhaAtual(response.data);
    } catch (err) {
      console.error('Erro ao buscar campanha', err);
    }
  };

  const handleProcessarCalculos = async () => {
    if (isProcessing || tracker.status === 'processing') return;
    setError('');
    setSuccessMessage('');
    setIsProcessing(true);

    try {
      await triggerCampaignRecalculation(token);
      setSuccessMessage('Cálculos e pontuações da campanha finalizados com sucesso!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError('Erro ao processar os cálculos da campanha.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEncerrarCampanhaSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      await api.post(`/campanha/encerrar`, {
        limparDadosBrutos
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage('Campanha encerrada com sucesso!');
      setIsEncerrarModalOpen(false);
      setLimparDadosBrutos(false);
      await fetchCampanhaAtual();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      const errorMsg = 
        errorDetail
          ? (typeof errorDetail === 'string'
              ? errorDetail
              : Array.isArray(errorDetail)
                ? errorDetail.map((d: any) => `${d.loc?.slice(1).join('.') || 'campo'}: ${d.msg}`).join(', ')
                : JSON.stringify(errorDetail))
          : (err.response?.data?.message || err.message || 'Erro ao encerrar a campanha.');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCriarNovaCampanha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataInicio || !duracaoMeses) {
      setError('Preencha a data de início e a duração da nova campanha.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Pré-calcula dataFim caso o backend necessite ou para garantir integridade
      let dataFimCalculada: string | undefined = undefined;
      try {
        const [y, m] = dataInicio.split('-').map(Number);
        if (y && m) {
          const totalM = (m - 1) + (Number(duracaoMeses) - 1);
          const endY = y + Math.floor(totalM / 12);
          const endM = (totalM % 12) + 1;
          const lastD = new Date(endY, endM, 0).getDate();
          dataFimCalculada = `${endY}-${String(endM).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        }
      } catch (e) {
        console.warn('Erro ao pré-calcular dataFim:', e);
      }

      await api.post(`/campanha/nova-campanha`, {
        dataInicio,
        dataFim: dataFimCalculada,
        duracaoMeses: Number(duracaoMeses)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage('Nova campanha criada com sucesso! Iniciando processamento de pontuações...');
      setIsNovaCampanhaModalOpen(false);
      setDataInicio('');
      await fetchCampanhaAtual();
      
      // Engatilha o cálculo automaticamente com barra de progresso
      handleProcessarCalculos();
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      const errorMsg = 
        errorDetail
          ? (typeof errorDetail === 'string'
              ? errorDetail
              : Array.isArray(errorDetail)
                ? errorDetail.map((d: any) => `${d.loc?.slice(1).join('.') || 'campo'}: ${d.msg}`).join(', ')
                : JSON.stringify(errorDetail))
          : (err.response?.data?.message || err.message || 'Erro ao iniciar nova campanha.');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Messages */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3 backdrop-blur-md animate-in fade-in duration-300">
          <Check size={20} className="shrink-0" />
          <p className="font-medium text-sm">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 backdrop-blur-md animate-in fade-in duration-300">
          <X size={20} className="shrink-0" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Card Principal com Glassmorphism Translúcido */}
      <div className="glass-bento border rounded-2xl p-6 shadow-sm transition-all duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-light-text-main dark:text-text-main flex items-center gap-2">
                Gestão de Campanha Ativa
                {campanhaAtual && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                    Em Andamento
                  </span>
                )}
              </h2>
              <p className="text-sm text-light-text-muted dark:text-text-muted mt-0.5">
                Defina os períodos de vigência, reprocessamento de pontuações e encerramento de ciclos.
              </p>
            </div>
          </div>
        </div>

        {/* Card Translúcido de Progresso de Apuração da Campanha */}
        {(tracker.status === 'processing' || isProcessing) && (
          <div className="mb-6 backdrop-blur-bento bg-light-surface-elevated/70 dark:bg-surface-elevated/60 border border-primary/30 p-5 rounded-2xl shadow-sm space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5 text-primary font-bold text-sm">
                <Loader2 size={18} className="animate-spin text-primary" />
                <span>{tracker.step || 'Contabilizando pontuações oficiais da campanha...'}</span>
              </div>
              <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                {tracker.progress || 25}%
              </span>
            </div>

            {/* Barra de Progresso com Gradiente */}
            <div className="w-full bg-light-surface dark:bg-surface rounded-full h-2.5 overflow-hidden p-0.5 border border-light-border dark:border-border">
              <div 
                className="bg-gradient-to-r from-primary to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm shadow-primary/30"
                style={{ width: `${Math.max(5, tracker.progress || 25)}%` }}
              />
            </div>

            {/* Métricas de Tempo Inteligentes */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-light-text-muted dark:text-text-muted border-t border-light-border dark:border-border/40 pt-3">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-light-text-muted dark:text-text-muted" />
                <span>Tempo decorrido: <strong className="text-light-text-main dark:text-text-main font-mono">{formatDuration(tracker.elapsed_seconds || 0)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Tempo estimado restante: <strong className="text-primary font-mono">{formatDuration(tracker.estimated_seconds_remaining || 5)}</strong></span>
              </div>
            </div>
          </div>
        )}

        {campanhaAtual ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-light-surface-elevated/80 dark:bg-surface-elevated/40 border border-light-border dark:border-border p-4 rounded-xl">
              <span className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Início da Campanha</span>
              <p className="text-lg font-bold text-light-text-main dark:text-text-main mt-1">
                {formatDate(campanhaAtual.dataInicio)}
              </p>
            </div>
            <div className="bg-light-surface-elevated/80 dark:bg-surface-elevated/40 border border-light-border dark:border-border p-4 rounded-xl">
              <span className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Fim da Campanha</span>
              <p className="text-lg font-bold text-light-text-main dark:text-text-main mt-1">
                {formatDate(campanhaAtual.dataFim)}
              </p>
            </div>
            <div className="bg-light-surface-elevated/80 dark:bg-surface-elevated/40 border border-light-border dark:border-border p-4 rounded-xl">
              <span className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Duração do Ciclo</span>
              <p className="text-lg font-bold text-primary mt-1">
                {campanhaAtual.duracaoMeses} {campanhaAtual.duracaoMeses === 1 ? 'Mês' : 'Meses'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-light-surface-elevated/80 dark:bg-surface-elevated/40 border border-light-border dark:border-border p-6 rounded-xl text-center mb-6">
            <p className="text-light-text-muted dark:text-text-muted">Nenhuma campanha ativa configurada no momento.</p>
          </div>
        )}

        {/* Ações da Campanha */}
        {campanhaAtual ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Configurar Regras da Campanha */}
            {isModerador && (
              <button 
                onClick={() => setIsEditCampaignOpen(true)}
                disabled={isProcessing || tracker.status === 'processing'}
                className="bg-light-surface-elevated hover:bg-light-surface-hover dark:bg-surface-elevated dark:hover:bg-surface-hover border border-light-border dark:border-border text-light-text-main dark:text-text-main px-4 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Settings size={18} className="text-primary" />
                Configurar Regras da Campanha
              </button>
            )}

            {/* Encerrar Campanha */}
            {isModerador && (
              <button 
                onClick={() => setIsEncerrarModalOpen(true)}
                disabled={isProcessing || tracker.status === 'processing'}
                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <PowerOff size={18} />
                Encerrar Campanha
              </button>
            )}
          </div>
        ) : (
          isModerador && (
            <button 
              onClick={() => setIsNovaCampanhaModalOpen(true)}
              className="mt-4 bg-primary hover:brightness-110 active:scale-[0.98] text-slate-950 px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 w-full sm:w-auto shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 border border-primary cursor-pointer"
            >
              <Plus size={20} />
              Nova Campanha
            </button>
          )
        )}
      </div>

      {/* Modal 1: Encerrar Campanha */}
      {isEncerrarModalOpen && isModerador && (
        <div className="fixed inset-0 lg:left-64 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-bento border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-light-border dark:border-border bg-light-background/60 dark:bg-input-bg/60">
              <h3 className="text-2xl font-bold text-rose-500 dark:text-rose-400 flex items-center gap-2">
                <PowerOff size={24} />
                Encerrar Campanha
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-light-text-main dark:text-text-main text-base font-medium">
                Você deseja encerrar a campanha atual?
              </p>
              <p className="text-light-text-secondary dark:text-text-muted text-sm leading-relaxed">
                Ao encerrar, a campanha ativa será finalizada e ficará disponível no histórico de ciclos concluídos.
              </p>

              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl space-y-2 mt-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center mt-0.5">
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={limparDadosBrutos}
                      onChange={(e) => setLimparDadosBrutos(e.target.checked)}
                    />
                    <div className={`w-5 h-5 rounded border ${limparDadosBrutos ? 'bg-rose-500 border-rose-500' : 'bg-slate-100 dark:bg-input-bg border-light-border dark:border-border'} transition-colors flex items-center justify-center`}>
                      {limparDadosBrutos && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <div>
                    <span className="text-rose-500 dark:text-rose-400 font-bold">Excluir Dados Operacionais Antigos</span>
                    <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1 leading-relaxed">
                      Marque se quiser limpar as tabelas de <strong>Chamados</strong>, <strong>Reincidências</strong> e <strong>Consumo de Peças</strong> da campanha que passou. 
                      <br/><strong className="text-emerald-600 dark:text-emerald-400">Os Resultados Mensais Apurados e Rankings ficarão salvos no histórico independentemente desta opção.</strong>
                    </p>
                  </div>
                </label>
              </div>

              {error && <p className="text-sm text-rose-500 dark:text-rose-400 font-semibold">{error}</p>}
            </div>

            <div className="p-6 border-t border-light-border dark:border-border bg-light-background/60 dark:bg-input-bg/60 flex justify-end gap-3">
              <button 
                onClick={() => setIsEncerrarModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main font-semibold transition-all cursor-pointer disabled:opacity-50"
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                onClick={handleEncerrarCampanhaSubmit}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md shadow-rose-500/20 border border-rose-500/50 hover:brightness-105"
              >
                {loading ? 'Encerrando...' : 'Sim, Encerrar Campanha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Nova Campanha */}
      {isNovaCampanhaModalOpen && isModerador && (
        <div className="fixed inset-0 lg:left-64 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="glass-bento border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-light-border dark:border-border bg-light-background/60 dark:bg-input-bg/60">
              <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Calendar />
                Configurar Nova Campanha
              </h3>
            </div>
            
            <form onSubmit={handleCriarNovaCampanha}>
              <div className="p-6 space-y-4">
                <p className="text-light-text-secondary dark:text-text-muted text-sm">
                  Preencha as informações abaixo para iniciar um novo ciclo de campanha:
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Data de Início</label>
                    <input 
                      type="date" 
                      required
                      className="w-full bg-slate-50 dark:bg-input-bg border border-light-border dark:border-border rounded-xl p-3 text-light-text-main dark:text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Duração (Meses)</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-input-bg border border-light-border dark:border-border rounded-xl p-3 text-light-text-main dark:text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer transition-all"
                      value={duracaoMeses}
                      onChange={(e) => setDuracaoMeses(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6, 12].map(meses => (
                        <option key={meses} value={meses}>{meses} {meses === 1 ? 'Mês' : 'Meses'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {error && <p className="text-sm text-rose-500 dark:text-rose-400 font-semibold">{error}</p>}
              </div>

              <div className="p-6 border-t border-light-border dark:border-border bg-light-background/60 dark:bg-input-bg/60 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsNovaCampanhaModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main font-semibold transition-all cursor-pointer disabled:opacity-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:brightness-110 active:scale-[0.98] text-slate-950 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 border border-primary"
                >
                  {loading ? 'Iniciando...' : 'Iniciar Nova Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModerador && (
        <EditCampaignModal 
          isOpen={isEditCampaignOpen}
          onClose={() => setIsEditCampaignOpen(false)}
          onProcessarMes={handleProcessarCalculos}
          isProcessing={isProcessing || tracker.status === 'processing'}
        />
      )}
    </div>
  );
}
