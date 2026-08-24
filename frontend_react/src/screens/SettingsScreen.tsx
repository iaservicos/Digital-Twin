import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Users, DatabaseZap, ShieldCheck, RefreshCw, Server, Cpu, Table, Calendar, Filter, Clock, Sparkles } from 'lucide-react';
import TecnicosManager from '../components/settings/TecnicosManager';
import CampaignManager from '../components/settings/CampaignManager';
import { useAuthStore } from '../store/authStore';
import { useSyncStore } from '../store/syncStore';

type SpreadSheetType = 'BaseDL' | 'Parts' | 'Reincidencia' | 'EncerradosRRC';
type TabType = 'UPLOADS' | 'TECNICOS' | 'CAMPANHA';
type PeriodMode = 'BIMESTRE' | 'CUSTOM';

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


interface UploadCardProps {
  type: SpreadSheetType;
  title: string;
  description: string;
  onUpload: (type: SpreadSheetType, file: File) => void;
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
  progress?: number;
}

const UploadCard = ({ type, title, description, onUpload, status, message, progress }: UploadCardProps) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(type, e.target.files[0]);
    }
  };

  return (
    <div className="bg-light-surface dark:bg-[#1e293b] rounded-2xl p-6 border border-light-borderStrong dark:border-border flex flex-col h-full shadow-lg relative overflow-hidden group hover:border-accent-teal/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-accent-teal/10 text-accent-teal rounded-xl">
          <FileSpreadsheet size={24} />
        </div>
        {status === 'success' && <CheckCircle className="text-emerald-400" size={24} />}
        {status === 'error' && <AlertCircle className="text-rose-400" size={24} />}
        {status === 'uploading' && <Loader2 className="text-accent-teal animate-spin" size={24} />}
      </div>
      
      <h3 className="text-lg font-bold text-light-text-main dark:text-text-main mb-1">{title}</h3>
      <p className="text-sm text-light-text-muted dark:text-text-muted mb-6 flex-grow">{description}</p>

      <div className="relative">
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv" 
          onChange={handleFileChange}
          disabled={status === 'uploading'}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
          id={`upload-${type}`}
        />
        <label 
          htmlFor={`upload-${type}`}
          className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all border ${
            status === 'uploading' 
              ? 'bg-slate-100 dark:bg-surface text-light-text-muted dark:text-text-muted border-light-borderStrong dark:border-border' 
              : 'bg-slate-50 dark:bg-[#0f172a] text-light-text-secondary dark:text-slate-300 border-light-borderStrong dark:border-border group-hover:bg-accent-teal/10 group-hover:text-accent-teal group-hover:border-accent-teal/30'
          }`}
        >
          <UploadCloud size={18} />
          {status === 'uploading' ? 'Processando...' : 'Selecionar Planilha'}
        </label>
      </div>

      {status === 'uploading' && progress !== undefined && (
        <div className="mt-4">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-accent-teal">{message || (progress === 100 ? 'Iniciando processamento...' : 'Enviando arquivo...')}</span>
            <span className="text-text-muted">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-surface rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full transition-all duration-300 ${progress === 100 && !message?.includes('inserindo') ? 'bg-accent-teal animate-pulse' : 'bg-accent-teal'}`} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {message && status !== 'uploading' && (
        <div className={`mt-4 p-3 rounded-lg text-xs font-medium ${status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default function SettingsScreen() {
  const { token } = useAuthStore();
  const { tracker, triggerSync } = useSyncStore();

  const [activeTab, setActiveTab] = useState<TabType>('UPLOADS');
  const [showLegacyUploads, setShowLegacyUploads] = useState<boolean>(false);

  // Filtros de Período / Bimestre
  const [periodMode, setPeriodMode] = useState<PeriodMode>('BIMESTRE');
  const [selectedBimestre, setSelectedBimestre] = useState<string>('4'); // 4º Bimestre (Jul/Ago) padrão 2026
  const [customDataInicio, setCustomDataInicio] = useState<string>('2026-07-01');
  const [customDataFim, setCustomDataFim] = useState<string>('2026-08-31');

  // Legacy Upload Status State
  const [uploadStatus, setUploadStatus] = useState<Record<SpreadSheetType, { status: 'idle' | 'uploading' | 'success' | 'error', message?: string, progress?: number }>>({
    BaseDL: { status: 'idle', progress: 0 },
    Parts: { status: 'idle', progress: 0 },
    Reincidencia: { status: 'idle', progress: 0 },
    EncerradosRRC: { status: 'idle', progress: 0 }
  });

  const getPeriodDates = (): { data_inicio: string, data_fim: string } => {
    if (periodMode === 'CUSTOM') {
      return { data_inicio: customDataInicio, data_fim: customDataFim };
    }
    const year = '2026';
    switch (selectedBimestre) {
      case '1': return { data_inicio: `${year}-01-01`, data_fim: `${year}-02-28` };
      case '2': return { data_inicio: `${year}-03-01`, data_fim: `${year}-04-30` };
      case '3': return { data_inicio: `${year}-05-01`, data_fim: `${year}-06-30` };
      case '4': return { data_inicio: `${year}-07-01`, data_fim: `${year}-08-31` };
      case '5': return { data_inicio: `${year}-09-01`, data_fim: `${year}-10-31` };
      case '6': return { data_inicio: `${year}-11-01`, data_fim: `${year}-12-31` };
      default: return { data_inicio: `${year}-07-01`, data_fim: `${year}-08-31` };
    }
  };

  const handleDatabricksSync = async () => {
    const { data_inicio, data_fim } = getPeriodDates();
    await triggerSync(data_inicio, data_fim);
  };

  const handleUpload = async (type: SpreadSheetType, file: File) => {
    setUploadStatus(prev => ({ ...prev, [type]: { status: 'uploading', progress: 0, message: 'Enviando arquivo para o servidor...' } }));

    const formData = new FormData();
    formData.append('file', file);

    try {
      const baseURL = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000';
      
      const response = await axios.post(`${baseURL}/api/ingestion/upload?type=${type}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadStatus(prev => {
              if (prev[type].status === 'uploading' && prev[type].message?.includes('Enviando arquivo')) {
                 return { ...prev, [type]: { status: 'uploading', progress: percentCompleted, message: `Enviando arquivo... ${percentCompleted}%` } };
              }
              return prev;
            });
          }
        }
      });
      
      const taskId = response.data.task_id;
      
      const intervalId = setInterval(async () => {
        try {
          const progressResponse = await axios.get(`${baseURL}/api/ingestion/progress/${taskId}`);
          const { status, progress, message } = progressResponse.data;

          if (status === 'completed') {
            clearInterval(intervalId);
            setUploadStatus(prev => ({ 
              ...prev, 
              [type]: { status: 'success', message: message || 'Arquivo processado com sucesso.', progress: 100 } 
            }));
          } else if (status === 'error') {
            clearInterval(intervalId);
            setUploadStatus(prev => ({ 
              ...prev, 
              [type]: { status: 'error', message: message || 'Erro durante o processamento.', progress: 0 } 
            }));
          } else {
            setUploadStatus(prev => ({ 
              ...prev, 
              [type]: { status: 'uploading', progress: progress, message: message } 
            }));
          }
        } catch (pollError) {
           console.error("Erro no polling", pollError);
           clearInterval(intervalId);
           setUploadStatus(prev => ({ 
             ...prev, 
             [type]: { status: 'error', message: 'Falha ao buscar progresso do servidor.', progress: 0 } 
           }));
        }
      }, 1000);

    } catch (error: any) {
      console.error("Erro no upload", error);
      setUploadStatus(prev => ({ 
        ...prev, 
        [type]: { status: 'error', message: error.response?.data?.detail || 'Erro ao processar planilha.', progress: 0 } 
      }));
    }
  };

  const activeDates = getPeriodDates();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300 pb-12">
      <div className="bg-light-surface/90 dark:bg-[#1e293b]/50 backdrop-blur-md rounded-3xl p-8 border border-light-borderStrong dark:border-border shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-teal/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        <h1 className="text-2xl font-bold text-light-text-main dark:text-text-main flex items-center gap-2 mb-2">
          <ShieldCheck className="text-accent-teal" size={24} />
          Painel do Moderador
        </h1>
        <p className="text-light-text-secondary dark:text-text-muted text-sm md:text-base max-w-2xl mb-8">
          Gerencie a base de dados do sistema Brilha+, sincronize dados bimestrais com o Databricks e inicie novos ciclos de campanha.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('UPLOADS')}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'UPLOADS' ? 'bg-accent-teal text-[#0f172a] shadow-lg shadow-accent-teal/20' : 'bg-slate-200 dark:bg-surface text-light-text-muted dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-surface/80 hover:text-light-text-main dark:hover:text-slate-200'}`}
          >
            <DatabaseZap size={20} />
            Ingestão Databricks
          </button>
          <button
            onClick={() => setActiveTab('TECNICOS')}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'TECNICOS' ? 'bg-accent-teal text-[#0f172a] shadow-lg shadow-accent-teal/20' : 'bg-slate-200 dark:bg-surface text-light-text-muted dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-surface/80 hover:text-light-text-main dark:hover:text-slate-200'}`}
          >
            <Users size={20} />
            Gestão de Usuários
          </button>
          <button
            onClick={() => setActiveTab('CAMPANHA')}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'CAMPANHA' ? 'bg-accent-teal text-[#0f172a] shadow-lg shadow-accent-teal/20' : 'bg-slate-200 dark:bg-surface text-light-text-muted dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-surface/80 hover:text-light-text-main dark:hover:text-slate-200'}`}
          >
            <ShieldCheck size={20} />
            Gestão de Campanha
          </button>
        </div>
      </div>

      <div className="pt-2">
        {activeTab === 'UPLOADS' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8">
            {/* Card Principal: Sincronização Direta Databricks com Progresso % e Contagem Regressiva */}
            <div className="bg-gradient-to-br from-light-surface to-slate-100 dark:from-[#1e293b] dark:to-[#0f172a] rounded-3xl p-8 border border-accent-teal/30 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/10 border border-accent-teal/30 text-accent-teal text-xs font-semibold">
                    <Server size={14} />
                    Databricks SQL Warehouse Active Connection
                  </div>
                  <h2 className="text-2xl font-bold text-light-text-main dark:text-text-main flex items-center gap-2">
                    <Cpu className="text-accent-teal" size={28} />
                    Sincronização Direta por Período Bimestral
                  </h2>
                  <p className="text-light-text-secondary dark:text-text-muted text-sm leading-relaxed">
                    Escolha o período da campanha para trazer apenas os dados relevantes do Databricks (<code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-accent-teal">datalake_prod.indicadores_servicos</code>) sem sobrecarregar o sistema.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <button
                    onClick={handleDatabricksSync}
                    disabled={tracker.status === 'processing'}
                    className="px-8 py-4 rounded-2xl bg-accent-teal hover:bg-accent-teal/90 text-[#0f172a] font-bold text-base shadow-xl shadow-accent-teal/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
                  >
                    <RefreshCw size={20} className={tracker.status === 'processing' ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                    {tracker.status === 'processing' ? 'Sincronizando...' : 'Sincronizar Databricks Agora'}
                  </button>
                </div>
              </div>

              {/* Seletor de Período / Bimestre */}
              <div className="mt-8 p-6 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-light-borderStrong dark:border-border/60 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2 font-bold text-light-text-main dark:text-text-main text-sm">
                    <Filter className="text-accent-teal" size={18} />
                    Filtro Temporal da Carga (Bimestre):
                  </div>

                  <div className="flex items-center gap-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setPeriodMode('BIMESTRE')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${periodMode === 'BIMESTRE' ? 'bg-accent-teal text-[#0f172a] shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      Seleção Bimestral
                    </button>
                    <button
                      onClick={() => setPeriodMode('CUSTOM')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${periodMode === 'CUSTOM' ? 'bg-accent-teal text-[#0f172a] shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      Data Personalizada
                    </button>
                  </div>
                </div>

                {periodMode === 'BIMESTRE' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                    {[
                      { id: '1', label: '1º Bimestre', period: 'Jan / Fev' },
                      { id: '2', label: '2º Bimestre', period: 'Mar / Abr' },
                      { id: '3', label: '3º Bimestre', period: 'Mai / Jun' },
                      { id: '4', label: '4º Bimestre', period: 'Jul / Ago' },
                      { id: '5', label: '5º Bimestre', period: 'Set / Out' },
                      { id: '6', label: '6º Bimestre', period: 'Nov / Dez' },
                    ].map(bim => (
                      <button
                        key={bim.id}
                        onClick={() => setSelectedBimestre(bim.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedBimestre === bim.id
                            ? 'bg-accent-teal/10 border-accent-teal text-accent-teal shadow-lg shadow-accent-teal/10'
                            : 'bg-slate-200/50 dark:bg-slate-800/40 border-light-borderStrong dark:border-border/40 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-xs font-bold">{bim.label}</div>
                        <div className="text-[11px] opacity-75">{bim.period}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Calendar size={14} /> Data Início:
                      </label>
                      <input 
                        type="date"
                        value={customDataInicio}
                        onChange={(e) => setCustomDataInicio(e.target.value)}
                        className="px-3 py-2 bg-slate-200 dark:bg-slate-800 border border-border/60 rounded-xl text-xs font-semibold text-text-main"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Calendar size={14} /> Data Fim:
                      </label>
                      <input 
                        type="date"
                        value={customDataFim}
                        onChange={(e) => setCustomDataFim(e.target.value)}
                        className="px-3 py-2 bg-slate-200 dark:bg-slate-800 border border-border/60 rounded-xl text-xs font-semibold text-text-main"
                      />
                    </div>
                  </div>
                )}

                <div className="text-xs text-accent-teal font-medium flex items-center gap-2 pt-1">
                  <span>Intervalo selecionado para a carga:</span>
                  <code className="bg-accent-teal/10 px-2 py-0.5 rounded font-mono font-bold">{activeDates.data_inicio} até {activeDates.data_fim}</code>
                </div>
              </div>

              {/* Barra de Progresso e Contagem Regressiva durante o processamento */}
              {tracker.status === 'processing' && (
                <div className="mt-8 p-6 bg-accent-teal/5 border border-accent-teal/30 rounded-2xl space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span className="text-accent-teal flex items-center gap-2">
                      <Loader2 className="animate-spin" size={18} />
                      {tracker.step}
                    </span>
                    <span className="text-accent-teal font-mono text-base">{tracker.progress}%</span>
                  </div>

                  {/* Barra de Progresso Animada */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-accent-teal/20">
                    <div 
                      className="h-full bg-gradient-to-r from-accent-teal to-emerald-400 rounded-full transition-all duration-500 shadow-lg shadow-accent-teal/30"
                      style={{ width: `${tracker.progress}%` }}
                    ></div>
                  </div>

                  {/* Contagem Regressiva e Tempo Estimado */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 font-medium">
                    <span className="flex items-center gap-1.5 text-accent-teal">
                      <Clock size={14} className="animate-pulse" />
                      Tempo restante estimado: <strong className="font-mono text-white font-bold">{formatDuration(tracker.estimated_seconds_remaining)}</strong>
                    </span>
                    <span>Tabela atual: <strong className="text-white font-mono">{formatTableName(tracker.current_table)}</strong></span>
                  </div>
                </div>
              )}

              {/* BANNER GLOWING DE SUCESSO / NOTIFICAÇÃO AO CONCLUIR 100% */}
              {tracker.status === 'success' && (
                <div className="mt-8 p-6 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-500 shadow-xl shadow-emerald-500/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                        Sincronização do Databricks Concluída com Sucesso!
                      </h3>
                      <p className="text-xs text-emerald-300/80 mt-0.5">
                        Os dados do período ({activeDates.data_inicio} até {activeDates.data_fim}) foram carregados e o recálculo dos pontos dos técnicos foi disparado.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-3 text-xs font-semibold text-emerald-200 border-t border-emerald-500/20">
                    <div>
                      <span>Registros Sincronizados: </span>
                      <strong className="font-mono text-white text-sm">{tracker.total_rows}</strong>
                    </div>
                    <div>
                      <span>Tempo Total Decorrido: </span>
                      <strong className="font-mono text-white text-sm">{formatDuration(tracker.elapsed_seconds)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* BANNER DE ERRO CASO OCORRA FALHA */}
              {tracker.status === 'failed' && (
                <div className="mt-8 p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-400 text-sm animate-in fade-in duration-300">
                  <AlertCircle size={20} className="mt-0.5 shrink-0" />
                  <div>
                    <strong className="font-bold block">Falha na Sincronização:</strong>
                    <p className="text-xs text-rose-300/80 mt-1">{tracker.error || tracker.step}</p>
                  </div>
                </div>
              )}

              {/* Grid de Tabelas Operacionais Sincronizadas com Status Dinâmico */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-light-borderStrong dark:border-border/50">
                <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  tracker.tables?.chamados?.status === 'success' 
                    ? 'bg-emerald-500/5 border-emerald-500/30' 
                    : tracker.tables?.chamados?.status === 'processing'
                    ? 'bg-accent-teal/10 border-accent-teal'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-light-borderStrong dark:border-border/40'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-accent-teal/10 text-accent-teal">
                      <Table size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-light-text-main dark:text-text-main">Chamados</h4>
                      <p className="text-xs text-light-text-muted dark:text-text-muted">
                        {tracker.tables?.chamados?.status === 'success' ? `${tracker.tables.chamados.rows} registros inseridos` : 'SLA & Dados Atendimento'}
                      </p>
                    </div>
                  </div>
                  {tracker.tables?.chamados?.status === 'success' && <CheckCircle className="text-emerald-400 shrink-0" size={20} />}
                  {tracker.tables?.chamados?.status === 'processing' && <Loader2 className="text-accent-teal animate-spin shrink-0" size={20} />}
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  tracker.tables?.reincidentes?.status === 'success' 
                    ? 'bg-emerald-500/5 border-emerald-500/30' 
                    : tracker.tables?.reincidentes?.status === 'processing'
                    ? 'bg-accent-teal/10 border-accent-teal'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-light-borderStrong dark:border-border/40'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-accent-teal/10 text-accent-teal">
                      <Table size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-light-text-main dark:text-text-main">Reincidências</h4>
                      <p className="text-xs text-light-text-muted dark:text-text-muted">
                        {tracker.tables?.reincidentes?.status === 'success' ? `${tracker.tables.reincidentes.rows} registros inseridos` : 'Voltas RRC'}
                      </p>
                    </div>
                  </div>
                  {tracker.tables?.reincidentes?.status === 'success' && <CheckCircle className="text-emerald-400 shrink-0" size={20} />}
                  {tracker.tables?.reincidentes?.status === 'processing' && <Loader2 className="text-accent-teal animate-spin shrink-0" size={20} />}
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  tracker.tables?.pecas?.status === 'success' 
                    ? 'bg-emerald-500/5 border-emerald-500/30' 
                    : tracker.tables?.pecas?.status === 'processing'
                    ? 'bg-accent-teal/10 border-accent-teal'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-light-borderStrong dark:border-border/40'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-accent-teal/10 text-accent-teal">
                      <Table size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-light-text-main dark:text-text-main">Peças</h4>
                      <p className="text-xs text-light-text-muted dark:text-text-muted">
                        {tracker.tables?.pecas?.status === 'success' ? `${tracker.tables.pecas.rows} registros inseridos` : 'Consumo de Peças'}
                      </p>
                    </div>
                  </div>
                  {tracker.tables?.pecas?.status === 'success' && <CheckCircle className="text-emerald-400 shrink-0" size={20} />}
                  {tracker.tables?.pecas?.status === 'processing' && <Loader2 className="text-accent-teal animate-spin shrink-0" size={20} />}
                </div>
              </div>
            </div>

            {/* Accordion de Ingestão Legada por Planilhas */}
            <div className="pt-4">
              <button
                onClick={() => setShowLegacyUploads(!showLegacyUploads)}
                className="text-sm font-semibold text-light-text-muted dark:text-text-muted hover:text-accent-teal flex items-center gap-2 transition-colors mb-4"
              >
                <FileSpreadsheet size={16} />
                {showLegacyUploads ? 'Ocultar Ingestão Legada por Planilha Excel' : 'Exibir Ingestão Legada por Planilha Excel (Fallback)'}
              </button>

              {showLegacyUploads && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
                  <UploadCard 
                    type="BaseDL"
                    title="Base DL (SLA)"
                    description="Planilha principal contendo todos os chamados da base DL e indicadores de SLA."
                    status={uploadStatus.BaseDL.status}
                    message={uploadStatus.BaseDL.message}
                    progress={uploadStatus.BaseDL.progress}
                    onUpload={handleUpload}
                  />
                  <UploadCard 
                    type="Parts"
                    title="Consumo de Peças"
                    description="Planilha contendo o detalhamento de peças aplicadas por chamado."
                    status={uploadStatus.Parts.status}
                    message={uploadStatus.Parts.message}
                    progress={uploadStatus.Parts.progress}
                    onUpload={handleUpload}
                  />
                  <UploadCard 
                    type="Reincidencia"
                    title="Reincidências (RRC)"
                    description="Planilha contendo os apontamentos de chamados reincidentes."
                    status={uploadStatus.Reincidencia.status}
                    message={uploadStatus.Reincidencia.message}
                    progress={uploadStatus.Reincidencia.progress}
                    onUpload={handleUpload}
                  />
                  <UploadCard 
                    type="EncerradosRRC"
                    title="Encerrados RRC"
                    description="Planilha base de encerrados, utilizada como divisor para cálculo de reincidência."
                    status={uploadStatus.EncerradosRRC.status}
                    message={uploadStatus.EncerradosRRC.message}
                    progress={uploadStatus.EncerradosRRC.progress}
                    onUpload={handleUpload}
                  />
                </div>
              )}
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
