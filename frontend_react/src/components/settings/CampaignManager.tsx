import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Calendar, AlertTriangle, ShieldAlert, Edit2, Check, X, PowerOff, Plus, RefreshCw, Settings, Sparkles, Clock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSyncStore } from '../../store/syncStore';
import { EditCampaignModal } from '../modals/EditCampaignModal';

export default function CampaignManager() {
  const { token, user } = useAuthStore();
  const { tracker, triggerCampaignRecalculation } = useSyncStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [duracaoMeses, setDuracaoMeses] = useState<number>(1);
  const [limparDadosBrutos, setLimparDadosBrutos] = useState(false);
  const [confirmText, setConfirmText] = useState('');
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
      const baseURL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080/api/v1';
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

  const handleReset = async () => {
    if (confirmText !== 'CONFIRMAR') {
      setError('Digite CONFIRMAR para prosseguir.');
      return;
    }
    
    if (!dataInicio || !duracaoMeses) {
      setError('Preencha a data de início e a duração da nova campanha.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const baseURL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8080/api/v1';
      await api.post(`/campanha/nova-campanha`, {
        dataInicio,
        duracaoMeses,
        limparDadosBrutos
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage('Nova campanha criada com sucesso! Iniciando processamento de pontuações...');
      setIsModalOpen(false);
      setConfirmText('');
      setLimparDadosBrutos(false);
      await fetchCampanhaAtual();
      
      // Engatilha o cálculo automaticamente com barra de progresso
      handleProcessarCalculos();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao iniciar nova campanha.');
    } finally {
      setLoading(false);
    }
  };

  const handleEncerrarCampanha = async () => {
    setIsModalOpen(true);
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
      <div className="backdrop-blur-md bg-slate-900/60 dark:bg-[#1e293b]/60 border border-border/40 dark:border-slate-800/80 rounded-2xl p-6 shadow-xl shadow-black/10 transition-all duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent-teal/10 border border-accent-teal/20 flex items-center justify-center text-accent-teal">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-light-text-main dark:text-slate-100 flex items-center gap-2">
                Gestão de Campanha Ativa
                {campanhaAtual && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold">
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
          <div className="mb-6 backdrop-blur-md bg-slate-950/60 dark:bg-[#0f172a]/60 border border-accent-teal/30 p-5 rounded-2xl shadow-xl shadow-black/20 space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5 text-accent-teal font-bold text-sm">
                <Loader2 size={18} className="animate-spin text-accent-teal" />
                <span>{tracker.step || 'Contabilizando pontuações oficiais da campanha...'}</span>
              </div>
              <span className="text-xs font-mono font-bold bg-accent-teal/10 text-accent-teal px-2.5 py-1 rounded-full border border-accent-teal/20">
                {tracker.progress || 25}%
              </span>
            </div>

            {/* Barra de Progresso com Gradiente */}
            <div className="w-full bg-slate-800/60 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700/50">
              <div 
                className="bg-gradient-to-r from-accent-teal to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm shadow-accent-teal/50"
                style={{ width: `${Math.max(5, tracker.progress || 25)}%` }}
              />
            </div>

            {/* Métricas de Tempo Inteligentes */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted border-t border-slate-800/40 pt-3">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                <span>Tempo decorrido: <strong className="text-slate-200 font-mono">{formatDuration(tracker.elapsed_seconds || 0)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Tempo estimado restante: <strong className="text-accent-teal font-mono">{formatDuration(tracker.estimated_seconds_remaining || 5)}</strong></span>
              </div>
            </div>
          </div>
        )}

        {campanhaAtual ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="backdrop-blur-sm bg-slate-950/40 dark:bg-[#0f172a]/40 border border-slate-800/50 p-4 rounded-xl">
              <span className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Início da Campanha</span>
              <p className="text-lg font-bold text-light-text-main dark:text-slate-200 mt-1">
                {formatDate(campanhaAtual.dataInicio)}
              </p>
            </div>
            <div className="backdrop-blur-sm bg-slate-950/40 dark:bg-[#0f172a]/40 border border-slate-800/50 p-4 rounded-xl">
              <span className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Fim da Campanha</span>
              <p className="text-lg font-bold text-light-text-main dark:text-slate-200 mt-1">
                {formatDate(campanhaAtual.dataFim)}
              </p>
            </div>
            <div className="backdrop-blur-sm bg-slate-950/40 dark:bg-[#0f172a]/40 border border-slate-800/50 p-4 rounded-xl">
              <span className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase tracking-wider">Duração do Ciclo</span>
              <p className="text-lg font-bold text-accent-teal mt-1">
                {campanhaAtual.duracaoMeses} {campanhaAtual.duracaoMeses === 1 ? 'Mês' : 'Meses'}
              </p>
            </div>
          </div>
        ) : (
          <div className="backdrop-blur-sm bg-slate-950/40 dark:bg-[#0f172a]/40 border border-slate-800/50 p-6 rounded-xl text-center mb-6">
            <p className="text-light-text-muted dark:text-text-muted">Nenhuma campanha ativa configurada no momento.</p>
          </div>
        )}

        {/* Ações da Campanha */}
        {campanhaAtual ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Configurar Regras da Campanha */}
            {isModerador && (
              <button 
                onClick={() => setIsEditCampaignOpen(true)}
                disabled={isProcessing || tracker.status === 'processing'}
                className="backdrop-blur-sm bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/60 text-slate-200 px-4 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Settings size={18} className="text-accent-teal" />
                Configurar Regras da Campanha
              </button>
            )}

            {/* Encerrar Campanha */}
            {isModerador && (
              <button 
                onClick={handleEncerrarCampanha}
                disabled={isProcessing || tracker.status === 'processing'}
                className="backdrop-blur-sm bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <PowerOff size={18} />
                Encerrar Campanha
              </button>
            )}

            {/* Atualizar Pontuações */}
            <button 
              onClick={handleProcessarCalculos}
              disabled={isProcessing || tracker.status === 'processing'}
              className={`bg-accent-teal hover:bg-accent-teal/90 text-white px-4 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-accent-teal/20 ${!isModerador ? 'md:col-span-3' : ''}`}
            >
              <RefreshCw size={18} className={(isProcessing || tracker.status === 'processing') ? 'animate-spin' : ''} />
              {(isProcessing || tracker.status === 'processing') ? 'Calculando...' : 'Atualizar Pontuações'}
            </button>
          </div>
        ) : (
          isModerador && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-4 bg-accent-teal hover:bg-accent-teal/90 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 w-full sm:w-auto shadow-md shadow-accent-teal/20"
            >
              <Plus size={20} />
              Nova Campanha
            </button>
          )
        )}
      </div>

      {isModalOpen && isModerador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="backdrop-blur-xl bg-slate-900/90 dark:bg-[#1e293b]/95 border border-light-borderStrong dark:border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-light-borderStrong dark:border-border">
              {campanhaAtual ? (
                <h3 className="text-2xl font-bold text-rose-400 flex items-center gap-2">
                  <AlertTriangle />
                  Atenção: Ação Irreversível
                </h3>
              ) : (
                <h3 className="text-2xl font-bold text-accent-teal flex items-center gap-2">
                  <Calendar />
                  Configurar Nova Campanha
                </h3>
              )}
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-slate-300">
                {campanhaAtual 
                  ? "Você está prestes a encerrar a campanha atual. Configure o próximo ciclo abaixo:" 
                  : "Preencha as informações abaixo para iniciar um novo ciclo de campanha:"}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Nova Data de Início</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl p-3 text-light-text-main dark:text-slate-200 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Duração (Meses)</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl p-3 text-light-text-main dark:text-slate-200 focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal cursor-pointer"
                    value={duracaoMeses}
                    onChange={(e) => setDuracaoMeses(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 12].map(meses => (
                      <option key={meses} value={meses}>{meses} {meses === 1 ? 'Mês' : 'Meses'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl space-y-2 mt-6">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center mt-0.5">
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={limparDadosBrutos}
                      onChange={(e) => setLimparDadosBrutos(e.target.checked)}
                    />
                    <div className={`w-5 h-5 rounded border ${limparDadosBrutos ? 'bg-rose-500 border-rose-500' : 'bg-slate-100 dark:bg-surface border-light-borderStrong dark:border-slate-600'} transition-colors flex items-center justify-center`}>
                      {limparDadosBrutos && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <div>
                    <span className="text-rose-400 font-bold">Excluir Dados Operacionais Antigos</span>
                    <p className="text-xs text-rose-400/80 mt-1 leading-relaxed">
                      Marque se quiser limpar as tabelas de <strong>Chamados</strong>, <strong>Reincidências</strong> e <strong>Consumo de Peças</strong> da campanha que passou. 
                      <br/><strong className="text-emerald-400">Os Resultados Mensais Apurados e Rankings ficarão salvos no histórico independentemente desta opção.</strong>
                    </p>
                  </div>
                </label>
              </div>

              <div className="space-y-1 mt-6">
                <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted uppercase">Digite CONFIRMAR para prosseguir</label>
                <input 
                  type="text" 
                  placeholder="CONFIRMAR"
                  className="w-full bg-slate-50 dark:bg-surface border border-light-borderStrong dark:border-border rounded-xl p-3 text-light-text-main dark:text-slate-200 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-rose-400 font-semibold">{error}</p>}
            </div>

            <div className="p-6 border-t border-light-borderStrong dark:border-border bg-slate-100 dark:bg-[#162032] flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl text-light-text-secondary dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-surface transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                onClick={handleReset}
                disabled={loading || confirmText !== 'CONFIRMAR'}
                className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? 'Processando...' : 'Iniciar Nova Campanha'}
              </button>
            </div>
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
