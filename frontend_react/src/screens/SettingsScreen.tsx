import React, { useState } from 'react';
import {
  Users,
  DatabaseZap,
  ShieldCheck,
  RefreshCw,
  Server,
  Cpu,
  Table,
  Calendar,
  Filter,
  Clock,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import TecnicosManager from '../components/settings/TecnicosManager';
import CampaignManager from '../components/settings/CampaignManager';
import { useAuthStore } from '../store/authStore';
import { useSyncStore } from '../store/syncStore';

type TabType = 'UPLOADS' | 'TECNICOS' | 'CAMPANHA';
type PeriodMode = 'BIMESTRE' | 'CUSTOM';

const formatDateBR = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const formatDuration = (totalSeconds?: number | null): string => {
  if (!totalSeconds || totalSeconds <= 0) return '0s';
  const sec = Math.round(totalSeconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
};

const formatTableName = (tableName?: string | null): string => {
  if (!tableName) return 'Inicializando';
  const map: Record<string, string> = {
    chamados: 'Chamados',
    reincidentes: 'Reincidências',
    pecas: 'Peças'
  };
  return map[tableName.toLowerCase()] || tableName;
};

export default function SettingsScreen() {
  const { token } = useAuthStore();
  const { tracker, triggerSync } = useSyncStore();
  const [activeTab, setActiveTab] = useState<TabType>('UPLOADS');

  // Controle de Modo de Período
  const [periodMode, setPeriodMode] = useState<PeriodMode>('BIMESTRE');
  const [selectedBimestre, setSelectedBimestre] = useState<string>('4'); // 4º Bimestre (Jul/Ago) padrão

  // Datas personalizadas (Fallback)
  const [customDataInicio, setCustomDataInicio] = useState('2026-07-01');
  const [customDataFim, setCustomDataFim] = useState('2026-08-31');

  // Mapeamento Bimestral da Campanha Brilha+
  const bimestreDates: Record<string, { data_inicio: string; data_fim: string; label: string; period: string }> = {
    '1': { data_inicio: '2026-01-01', data_fim: '2026-02-28', label: '1º Bimestre', period: 'Jan / Fev' },
    '2': { data_inicio: '2026-03-01', data_fim: '2026-04-30', label: '2º Bimestre', period: 'Mar / Abr' },
    '3': { data_inicio: '2026-05-01', data_fim: '2026-06-30', label: '3º Bimestre', period: 'Mai / Jun' },
    '4': { data_inicio: '2026-07-01', data_fim: '2026-08-31', label: '4º Bimestre', period: 'Jul / Ago' },
    '5': { data_inicio: '2026-09-01', data_fim: '2026-10-31', label: '5º Bimestre', period: 'Set / Out' },
    '6': { data_inicio: '2026-11-01', data_fim: '2026-12-31', label: '6º Bimestre', period: 'Nov / Dez' },
  };

  const getActivePeriodDates = () => {
    if (periodMode === 'BIMESTRE') {
      return bimestreDates[selectedBimestre] || bimestreDates['4'];
    }
    return {
      data_inicio: customDataInicio,
      data_fim: customDataFim,
      label: 'Personalizado',
      period: 'Custom'
    };
  };

  const activeDates = getActivePeriodDates();

  const handleDatabricksSync = async () => {
    try {
      await triggerSync(activeDates.data_inicio, activeDates.data_fim);
      
    } catch (e) {
      console.error('Erro ao acionar sincronização:', e);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Cabeçalho do Painel do Moderador */}
      <div className="bg-light-surface dark:bg-surface rounded-3xl p-8 border border-light-borderStrong dark:border-border shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-accent-teal font-bold text-sm tracking-wide uppercase">
            <ShieldCheck size={20} />
            Painel do Moderador
          </div>
          <h1 className="text-3xl font-black text-light-text-main dark:text-text-main tracking-tight">
            Gestão Operacional & Ingestão
          </h1>
          <p className="text-light-text-muted dark:text-text-muted text-sm max-w-2xl">
            Gerencie a base de dados do sistema Brilha+, sincronize dados bimestrais com o Databricks e inicie novos ciclos de campanha.
          </p>
        </div>

        {/* Navegação por Abas */}
        <div className="flex items-center gap-2 mt-8 p-1.5 bg-slate-100 dark:bg-slate-900/80 border border-light-borderStrong dark:border-border/80 rounded-2xl w-fit flex-wrap">
          <button
            onClick={() => setActiveTab('UPLOADS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'UPLOADS'
                ? 'bg-accent-teal text-[#0f172a] shadow-lg shadow-accent-teal/20'
                : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <DatabaseZap size={18} />
            Ingestão Databricks
          </button>
          <button
            onClick={() => setActiveTab('TECNICOS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'TECNICOS'
                ? 'bg-accent-teal text-[#0f172a] shadow-lg shadow-accent-teal/20'
                : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Users size={18} />
            Gestão de Usuários
          </button>
          <button
            onClick={() => setActiveTab('CAMPANHA')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'CAMPANHA'
                ? 'bg-accent-teal text-[#0f172a] shadow-lg shadow-accent-teal/20'
                : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck size={18} />
            Gestão de Campanha
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="pt-2">
        {activeTab === 'UPLOADS' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Card Principal: Sincronização Databricks (Fiel ao Excalidraw e Tailwind) */}
            <div className="bg-light-surface dark:bg-surface rounded-3xl p-8 border border-light-borderStrong dark:border-border shadow-2xl relative overflow-hidden space-y-8">
              
              {/* Header do Card com Textos Ajustados do Excalidraw */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2 max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/10 border border-accent-teal/30 text-accent-teal text-xs font-semibold">
                    <Server size={14} className="text-accent-teal" />
                    Databricks SQL Connection
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-light-text-main dark:text-text-main tracking-tight flex items-center gap-3">
                    <Cpu className="text-accent-teal shrink-0" size={30} />
                    Sincronização por período
                  </h2>
                  <p className="text-light-text-muted dark:text-text-muted text-sm leading-relaxed">
                    Selecione o periodo para sincronização
                  </p>
                </div>

                <div className="flex items-center shrink-0">
                  <button
                    onClick={handleDatabricksSync}
                    disabled={tracker.status === 'processing'}
                    className="px-7 py-3.5 rounded-2xl bg-accent-teal hover:bg-accent-teal/90 text-[#0f172a] font-bold text-sm shadow-lg shadow-accent-teal/25 hover:shadow-accent-teal/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCw size={18} className={tracker.status === 'processing' ? 'animate-spin' : ''} />
                    {tracker.status === 'processing' ? 'Sincronizando...' : 'Sincronizar agora'}
                  </button>
                </div>
              </div>

              {/* Seletor de Período / Bimestre */}
              <div className="p-6 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-light-borderStrong dark:border-border/60 space-y-5 relative z-10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2 font-bold text-light-text-main dark:text-text-main text-sm">
                    <Filter className="text-accent-teal" size={18} />
                    Filtro bimestral
                  </div>

                  <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-950/80 border border-light-borderStrong dark:border-border p-1 rounded-xl">
                    <button
                      onClick={() => setPeriodMode('BIMESTRE')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        periodMode === 'BIMESTRE' 
                          ? 'bg-accent-teal text-[#0f172a] font-bold shadow-md shadow-accent-teal/20' 
                          : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white'
                      }`}
                    >
                      Seleção Bimestral
                    </button>
                    <button
                      onClick={() => setPeriodMode('CUSTOM')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        periodMode === 'CUSTOM' 
                          ? 'bg-accent-teal text-[#0f172a] font-bold shadow-md shadow-accent-teal/20' 
                          : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white'
                      }`}
                    >
                      Data Personalizada
                    </button>
                  </div>
                </div>

                {periodMode === 'BIMESTRE' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1">
                    {[
                      { id: '1', label: '1º Bimestre', period: 'Jan / Fev' },
                      { id: '2', label: '2º Bimestre', period: 'Mar / Abr' },
                      { id: '3', label: '3º Bimestre', period: 'Mai / Jun' },
                      { id: '4', label: '4º Bimestre', period: 'Jul / Ago' },
                      { id: '5', label: '5º Bimestre', period: 'Set / Out' },
                      { id: '6', label: '6º Bimestre', period: 'Nov / Dez' },
                    ].map(bim => {
                      const isSelected = selectedBimestre === bim.id;
                      return (
                        <button
                          key={bim.id}
                          onClick={() => setSelectedBimestre(bim.id)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                            isSelected
                              ? 'bg-accent-teal/10 border-accent-teal text-accent-teal shadow-lg shadow-accent-teal/10 ring-1 ring-accent-teal/40'
                              : 'bg-light-surface dark:bg-slate-950/40 border-light-borderStrong dark:border-border/60 text-light-text-muted dark:text-text-muted hover:border-accent-teal/50 hover:text-light-text-main dark:hover:text-white'
                          }`}
                        >
                          <div className={`text-xs font-bold ${isSelected ? 'text-accent-teal' : 'text-light-text-main dark:text-slate-200'}`}>{bim.label}</div>
                          <div className="text-[11px] opacity-75 mt-0.5">{bim.period}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted flex items-center gap-1">
                        <Calendar size={14} className="text-accent-teal" /> Data Início:
                      </label>
                      <input
                        type="date"
                        value={customDataInicio}
                        onChange={(e) => setCustomDataInicio(e.target.value)}
                        className="px-3 py-2 bg-light-surface dark:bg-slate-950 border border-light-borderStrong dark:border-border rounded-xl text-xs font-semibold text-light-text-main dark:text-text-main focus:border-accent-teal outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted flex items-center gap-1">
                        <Calendar size={14} className="text-accent-teal" /> Data Fim:
                      </label>
                      <input
                        type="date"
                        value={customDataFim}
                        onChange={(e) => setCustomDataFim(e.target.value)}
                        className="px-3 py-2 bg-light-surface dark:bg-slate-950 border border-light-borderStrong dark:border-border rounded-xl text-xs font-semibold text-light-text-main dark:text-text-main focus:border-accent-teal outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Badge de Intervalo Formatado em dd/mm/aaaa */}
                <div className="text-xs text-accent-teal font-medium flex items-center gap-2 pt-2 border-t border-light-borderStrong dark:border-border/60">
                  <span className="text-light-text-muted dark:text-text-muted">Intervalo selecionado:</span>
                  <span className="bg-accent-teal/10 border border-accent-teal/30 text-accent-teal px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs tracking-wide">
                    {formatDateBR(activeDates.data_inicio)} até {formatDateBR(activeDates.data_fim)}
                  </span>
                </div>
              </div>

              {/* Status Global em Processamento */}
              {tracker.status === 'processing' && (
                <div className="p-5 bg-accent-teal/10 border border-accent-teal/30 rounded-2xl space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                    <span className="text-accent-teal flex items-center gap-2">
                      <Loader2 className="animate-spin text-accent-teal shrink-0" size={16} />
                      {tracker.step}
                    </span>
                    <span className="text-accent-teal font-mono text-sm">{tracker.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-900 rounded-full h-2.5 overflow-hidden p-0.5 border border-accent-teal/20">
                    <div
                      className="h-full bg-gradient-to-r from-accent-teal to-emerald-400 rounded-full transition-all duration-500 shadow-lg shadow-accent-teal/30"
                      style={{ width: `${tracker.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-light-text-muted dark:text-text-muted font-medium">
                    <span className="flex items-center gap-1.5 text-accent-teal">
                      <Clock size={13} className="animate-pulse" />
                      Tempo restante estimado: <strong className="font-mono text-light-text-main dark:text-white font-bold">{formatDuration(tracker.estimated_seconds_remaining)}</strong>
                    </span>
                    <span>Tabela atual: <strong className="text-light-text-main dark:text-white font-mono">{formatTableName(tracker.current_table)}</strong></span>
                  </div>
                </div>
              )}

              {/* Banner de Sucesso */}
              {tracker.status === 'success' && (
                <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-400">Sincronização Concluída com Sucesso!</h3>
                      <p className="text-xs text-emerald-300/80 mt-0.5">
                        Dados de {formatDateBR(activeDates.data_inicio)} até {formatDateBR(activeDates.data_fim)} carregados e apuração recalculada.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Banner de Erro */}
              {tracker.status === 'failed' && (
                <div className="p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-400 text-xs animate-in fade-in duration-300">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block text-sm">Falha na Sincronização:</strong>
                    <p className="text-rose-300/80 mt-0.5">{tracker.error || tracker.step}</p>
                  </div>
                </div>
              )}

              {/* Grid dos 3 Cards Operacionais com BARRAS DE PROGRESSO INDIVIDUAIS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* 1. Card Chamados */}
                {(() => {
                  const tableStatus = tracker.tables?.chamados?.status || 'pending';
                  const isProc = tableStatus === 'processing';
                  const isDone = tableStatus === 'success';
                  const progressPct = isDone ? 100 : isProc ? Math.min(90, Math.max(25, tracker.progress)) : 0;
                  const rowCount = tracker.tables?.chamados?.rows || 0;

                  return (
                    <div className={`p-5 rounded-2xl border transition-all space-y-3.5 relative overflow-hidden ${
                      isDone 
                        ? 'bg-light-surface dark:bg-surface border-emerald-500/40 shadow-lg' 
                        : isProc 
                        ? 'bg-light-surface dark:bg-surface border-accent-teal shadow-lg ring-1 ring-accent-teal/40' 
                        : 'bg-light-surface dark:bg-surface border-light-borderStrong dark:border-border'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${isDone ? 'bg-emerald-500/10 text-emerald-400' : isProc ? 'bg-accent-teal/10 text-accent-teal' : 'bg-slate-200/60 dark:bg-slate-800/60 text-light-text-muted dark:text-text-muted'}`}>
                            <Table size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-light-text-main dark:text-text-main">Chamados</h4>
                            <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">SLA & Dados Atendimento</p>
                          </div>
                        </div>
                        {isDone && <CheckCircle className="text-emerald-400 shrink-0" size={18} />}
                        {isProc && <Loader2 className="text-accent-teal animate-spin shrink-0" size={18} />}
                      </div>

                      {/* Barra de Progresso Individual */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-light-text-muted dark:text-text-muted">
                          <span>{isDone ? `${rowCount.toLocaleString('pt-BR')} registros` : isProc ? 'Extraindo dados...' : 'Pendente'}</span>
                          <span className={isDone ? 'text-emerald-400 font-mono' : isProc ? 'text-accent-teal font-mono' : 'text-slate-400'}>
                            {progressPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-light-borderStrong dark:border-border">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isDone 
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' 
                                : isProc 
                                ? 'bg-gradient-to-r from-accent-teal to-emerald-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' 
                                : 'bg-transparent'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Card Reincidências */}
                {(() => {
                  const tableStatus = tracker.tables?.reincidentes?.status || 'pending';
                  const isProc = tableStatus === 'processing';
                  const isDone = tableStatus === 'success';
                  const progressPct = isDone ? 100 : isProc ? Math.min(90, Math.max(25, tracker.progress)) : 0;
                  const rowCount = tracker.tables?.reincidentes?.rows || 0;

                  return (
                    <div className={`p-5 rounded-2xl border transition-all space-y-3.5 relative overflow-hidden ${
                      isDone 
                        ? 'bg-light-surface dark:bg-surface border-emerald-500/40 shadow-lg' 
                        : isProc 
                        ? 'bg-light-surface dark:bg-surface border-accent-teal shadow-lg ring-1 ring-accent-teal/40' 
                        : 'bg-light-surface dark:bg-surface border-light-borderStrong dark:border-border'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${isDone ? 'bg-emerald-500/10 text-emerald-400' : isProc ? 'bg-accent-teal/10 text-accent-teal' : 'bg-slate-200/60 dark:bg-slate-800/60 text-light-text-muted dark:text-text-muted'}`}>
                            <RefreshCw size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-light-text-main dark:text-text-main">Reincidências</h4>
                            <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">Voltas RRC</p>
                          </div>
                        </div>
                        {isDone && <CheckCircle className="text-emerald-400 shrink-0" size={18} />}
                        {isProc && <Loader2 className="text-accent-teal animate-spin shrink-0" size={18} />}
                      </div>

                      {/* Barra de Progresso Individual */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-light-text-muted dark:text-text-muted">
                          <span>{isDone ? `${rowCount.toLocaleString('pt-BR')} registros` : isProc ? 'Extraindo dados...' : 'Pendente'}</span>
                          <span className={isDone ? 'text-emerald-400 font-mono' : isProc ? 'text-accent-teal font-mono' : 'text-slate-400'}>
                            {progressPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-light-borderStrong dark:border-border">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isDone 
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' 
                                : isProc 
                                ? 'bg-gradient-to-r from-accent-teal to-emerald-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' 
                                : 'bg-transparent'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Card Peças */}
                {(() => {
                  const tableStatus = tracker.tables?.pecas?.status || 'pending';
                  const isProc = tableStatus === 'processing';
                  const isDone = tableStatus === 'success';
                  const progressPct = isDone ? 100 : isProc ? Math.min(90, Math.max(25, tracker.progress)) : 0;
                  const rowCount = tracker.tables?.pecas?.rows || 0;

                  return (
                    <div className={`p-5 rounded-2xl border transition-all space-y-3.5 relative overflow-hidden ${
                      isDone 
                        ? 'bg-light-surface dark:bg-surface border-emerald-500/40 shadow-lg' 
                        : isProc 
                        ? 'bg-light-surface dark:bg-surface border-accent-teal shadow-lg ring-1 ring-accent-teal/40' 
                        : 'bg-light-surface dark:bg-surface border-light-borderStrong dark:border-border'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${isDone ? 'bg-emerald-500/10 text-emerald-400' : isProc ? 'bg-accent-teal/10 text-accent-teal' : 'bg-slate-200/60 dark:bg-slate-800/60 text-light-text-muted dark:text-text-muted'}`}>
                            <DatabaseZap size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-light-text-main dark:text-text-main">Peças</h4>
                            <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">Consumo de Peças</p>
                          </div>
                        </div>
                        {isDone && <CheckCircle className="text-emerald-400 shrink-0" size={18} />}
                        {isProc && <Loader2 className="text-accent-teal animate-spin shrink-0" size={18} />}
                      </div>

                      {/* Barra de Progresso Individual */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-light-text-muted dark:text-text-muted">
                          <span>{isDone ? `${rowCount.toLocaleString('pt-BR')} registros` : isProc ? 'Extraindo dados...' : 'Pendente'}</span>
                          <span className={isDone ? 'text-emerald-400 font-mono' : isProc ? 'text-accent-teal font-mono' : 'text-slate-400'}>
                            {progressPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden border border-light-borderStrong dark:border-border">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isDone 
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' 
                                : isProc 
                                ? 'bg-gradient-to-r from-accent-teal to-emerald-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' 
                                : 'bg-transparent'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'TECNICOS' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <TecnicosManager />
          </div>
        )}

        {activeTab === 'CAMPANHA' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CampaignManager />
          </div>
        )}
      </div>
    </div>
  );
}
