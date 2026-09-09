import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
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
  Loader2,
  FileSpreadsheet,
  UploadCloud,
  FileText,
  HelpCircle,
  CheckCircle2,
  Layers,
  BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';
import TecnicosManager from '../components/settings/TecnicosManager';
import CampaignManager from '../components/settings/CampaignManager';
import { useAuthStore } from '../store/authStore';
import { useSyncStore, getPythonApiUrl, getPythonHeaders } from '../store/syncStore';

type TabType = 'UPLOADS' | 'TECNICOS' | 'CAMPANHA';
type IngestMode = 'planilhas' | 'databricks';
type SpreadSheetType = 'BaseDL' | 'Parts' | 'Reincidencia' | 'EncerradosRRC';
type PeriodMode = 'BIMESTRE' | 'CUSTOM';

interface UploadCardState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  message?: string;
  totalRows?: number;
  error?: string;
}

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

// =============================================================================
// SUB-COMPONENTE: CARD DE UPLOAD DE PLANILHA INDIVIDUAL
// =============================================================================
interface UploadCardProps {
  type: SpreadSheetType;
  title: string;
  subtitle: string;
  columnsExpected: string[];
  description: string;
  state: UploadCardState;
  onUpload: (type: SpreadSheetType, file: File) => void;
}

const UploadCard: React.FC<UploadCardProps> = ({
  type,
  title,
  subtitle,
  columnsExpected,
  description,
  state,
  onUpload
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showColumns, setShowColumns] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(type, e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(type, e.dataTransfer.files[0]);
    }
  };

  const isUploading = state.status === 'uploading';
  const isSuccess = state.status === 'success';
  const isError = state.status === 'error';

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`bg-light-surface dark:bg-surface rounded-2xl p-6 border transition-all flex flex-col justify-between relative overflow-hidden shadow-md group ${
        isDragOver
          ? 'border-accent-teal ring-2 ring-accent-teal/40 bg-accent-teal/5'
          : isSuccess
          ? 'border-emerald-500/40 hover:border-emerald-500/70'
          : isError
          ? 'border-rose-500/40 hover:border-rose-500/70'
          : isUploading
          ? 'border-accent-teal ring-1 ring-accent-teal/30'
          : 'border-light-borderStrong dark:border-border hover:border-accent-teal/40'
      }`}
    >
      <div className="space-y-4">
        {/* Header do Card */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 ${
              isSuccess 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : isUploading 
                ? 'bg-accent-teal/10 text-accent-teal' 
                : isError
                ? 'bg-rose-500/10 text-rose-400'
                : 'bg-slate-100 dark:bg-slate-800 text-light-text-muted dark:text-text-muted group-hover:text-accent-teal group-hover:bg-accent-teal/10'
            }`}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-light-text-main dark:text-text-main leading-tight">{title}</h3>
              <p className="text-xs text-accent-teal font-semibold mt-0.5 leading-snug">{subtitle}</p>
            </div>
          </div>

          {isSuccess && <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={20} />}
          {isError && <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={20} />}
          {isUploading && <Loader2 className="text-accent-teal animate-spin shrink-0 mt-0.5" size={20} />}
        </div>

        {/* Descrição Completa e Legível */}
        <p className="text-xs sm:text-sm text-light-text-muted dark:text-text-muted leading-relaxed">
          {description}
        </p>

        {/* Accordion de Colunas Obrigatórias */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowColumns(!showColumns)}
            className="text-xs text-light-text-muted dark:text-text-muted hover:text-accent-teal flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
          >
            <HelpCircle size={14} />
            {showColumns ? 'Ocultar colunas esperadas' : `Ver ${columnsExpected.length} colunas esperadas`}
          </button>

          {showColumns && (
            <div className="mt-3 p-3.5 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-light-borderStrong dark:border-border/60 text-xs space-y-1.5 animate-in fade-in duration-200">
              <span className="font-bold text-accent-teal block text-xs">Colunas esperadas no Excel/CSV:</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {columnsExpected.map((col, idx) => (
                  <span key={idx} className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono text-[11px] text-light-text-main dark:text-slate-200">
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seção de Ação e Progresso */}
      <div className="pt-5 space-y-3.5">
        {/* Barra de Progresso Durante Upload */}
        {isUploading && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-accent-teal flex items-center gap-1.5 truncate max-w-[240px]" title={state.message}>
                <Loader2 size={13} className="animate-spin shrink-0" />
                {state.message || 'Processando planilha...'}
              </span>
              <span className="text-accent-teal font-mono shrink-0">{state.progress}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-2 overflow-hidden border border-accent-teal/20">
              <div 
                className="h-full bg-gradient-to-r from-accent-teal to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Feedback de Sucesso */}
        {isSuccess && state.message && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-medium flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span className="text-xs leading-relaxed">{state.message}</span>
          </div>
        )}

        {/* Feedback de Erro */}
        {isError && (state.error || state.message) && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="text-xs leading-relaxed break-words">{state.error || state.message}</span>
          </div>
        )}

        {/* Botão de Seleção */}
        <div className="relative">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFileChange}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
            id={`upload-${type}`}
          />
          <label 
            htmlFor={`upload-${type}`}
            className={`flex items-center justify-center gap-2.5 w-full py-3 px-5 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer ${
              isUploading 
                ? 'bg-slate-100 dark:bg-surface text-light-text-muted dark:text-text-muted border-light-borderStrong dark:border-border cursor-not-allowed' 
                : isSuccess
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-900 text-light-text-main dark:text-slate-200 border-light-borderStrong dark:border-border hover:bg-accent-teal/10 hover:text-accent-teal hover:border-accent-teal/40 shadow-sm'
            }`}
          >
            <UploadCloud size={18} />
            {isUploading ? 'Processando Lote...' : isSuccess ? 'Substituir Planilha' : 'Selecionar Arquivo'}
          </label>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// COMPONENTE PRINCIPAL SETTINGSSCREEN
// =============================================================================
export default function SettingsScreen() {
  const { token } = useAuthStore();
  const { tracker, triggerSync } = useSyncStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Estados de Navegação
  const tabParam = (searchParams.get('tab') as TabType) || 'UPLOADS';
  const modeParam = (searchParams.get('mode') as IngestMode) || 'planilhas';

  const [activeTab, setActiveTab] = useState<TabType>(tabParam);
  const [ingestMode, setIngestMode] = useState<IngestMode>(modeParam);
  const [recalculating, setRecalculating] = useState(false);

  // Sincronizar parâmetros de URL com o estado
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    const mode = searchParams.get('mode') as IngestMode;
    if (tab && ['UPLOADS', 'TECNICOS', 'CAMPANHA'].includes(tab)) {
      setActiveTab(tab);
    }
    if (mode && ['planilhas', 'databricks'].includes(mode)) {
      setIngestMode(mode);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: TabType) => {
    setActiveTab(newTab);
    setSearchParams(prev => {
      prev.set('tab', newTab);
      return prev;
    });
  };

  const handleModeChange = (newMode: IngestMode) => {
    setIngestMode(newMode);
    setSearchParams(prev => {
      prev.set('tab', 'UPLOADS');
      prev.set('mode', newMode);
      return prev;
    });
  };

  // Estados de Upload das 4 Planilhas
  const [uploadStates, setUploadStates] = useState<Record<SpreadSheetType, UploadCardState>>({
    BaseDL: { status: 'idle', progress: 0 },
    Parts: { status: 'idle', progress: 0 },
    Reincidencia: { status: 'idle', progress: 0 },
    EncerradosRRC: { status: 'idle', progress: 0 }
  });

  // Controle de Período Databricks
  const [periodMode, setPeriodMode] = useState<PeriodMode>('BIMESTRE');
  const [selectedBimestre, setSelectedBimestre] = useState<string>('4');
  const [customDataInicio, setCustomDataInicio] = useState('2026-07-01');
  const [customDataFim, setCustomDataFim] = useState('2026-08-31');

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

  // Handler de Upload de Planilha Individual
  const handleSpreadsheetUpload = async (type: SpreadSheetType, file: File) => {
    setUploadStates(prev => ({
      ...prev,
      [type]: {
        status: 'uploading',
        progress: 10,
        message: `Enviando ${file.name} para o servidor...`
      }
    }));

    const formData = new FormData();
    formData.append('file', file);

    try {
      const pythonUrl = getPythonApiUrl();
      const headers = getPythonHeaders();

      const response = await axios.post(
        `${pythonUrl}/api/v1/ingestion/upload?type=${type}`,
        formData,
        {
          headers: {
            ...headers,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round((progressEvent.loaded * 25) / progressEvent.total);
              setUploadStates(prev => ({
                ...prev,
                [type]: {
                  ...prev[type],
                  progress: Math.max(10, pct),
                  message: `Enviando arquivo (${Math.round((progressEvent.loaded / 1024 / 1024) * 10) / 10} MB)...`
                }
              }));
            }
          }
        }
      );

      const taskId = response.data.task_id;

      // Polling de Progresso
      const intervalId = setInterval(async () => {
        try {
          const pollRes = await axios.get(`${pythonUrl}/api/v1/ingestion/progress/${taskId}`, {
            headers: getPythonHeaders()
          });

          const { status, progress, message, total_rows } = pollRes.data;

          if (status === 'completed') {
            clearInterval(intervalId);
            setUploadStates(prev => ({
              ...prev,
              [type]: {
                status: 'success',
                progress: 100,
                message: message || 'Planilha importada com sucesso!',
                totalRows: total_rows
              }
            }));
            toast.success(`Planilha ${type} importada com sucesso!`);
          } else if (status === 'error') {
            clearInterval(intervalId);
            setUploadStates(prev => ({
              ...prev,
              [type]: {
                status: 'error',
                progress: 0,
                message: message || 'Falha ao processar planilha.',
                error: message
              }
            }));
            toast.error(`Erro ao processar planilha ${type}`);
          } else {
            setUploadStates(prev => ({
              ...prev,
              [type]: {
                status: 'uploading',
                progress: Math.min(98, Math.max(25, progress || 25)),
                message: message || 'Processando linhas...'
              }
            }));
          }
        } catch (pollErr) {
          console.error('Erro no polling da planilha:', pollErr);
          clearInterval(intervalId);
          setUploadStates(prev => ({
            ...prev,
            [type]: {
              status: 'error',
              progress: 0,
              message: 'Erro de comunicação ao checar progresso.'
            }
          }));
        }
      }, 1000);

    } catch (err: any) {
      console.error('Erro no upload da planilha:', err);
      const errDetail = err.response?.data?.detail || err.message || 'Erro de conexão com o servidor de ingestão.';
      setUploadStates(prev => ({
        ...prev,
        [type]: {
          status: 'error',
          progress: 0,
          error: errDetail,
          message: errDetail
        }
      }));
      toast.error(`Falha no upload: ${errDetail}`);
    }
  };

  // Recalcular Campanha Oficial
  const handleRecalcularCampanha = async () => {
    setRecalculating(true);
    try {
      const pythonUrl = getPythonApiUrl();
      const res = await axios.post(
        `${pythonUrl}/api/v1/calculo/campanha`,
        {},
        { headers: getPythonHeaders() }
      );
      if (res.data?.status === 'success') {
        toast.success('Apuração oficial da campanha recalculada com sucesso!');
      }
    } catch (e: any) {
      console.error('Erro ao recalcular campanha:', e);
      toast.error('Erro ao acionar recálculo da campanha.');
    } finally {
      setRecalculating(false);
    }
  };

  // Disparar Sincronização Databricks
  const handleDatabricksSync = async () => {
    try {
      await triggerSync(activeDates.data_inicio, activeDates.data_fim);
    } catch (e) {
      console.error('Erro ao acionar sincronização:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      
      {/* Header Enxuto do Painel do Moderador */}
      <div className="bg-light-surface dark:bg-surface rounded-3xl p-6 sm:p-8 border border-light-borderStrong dark:border-border shadow-xl relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/10 border border-accent-teal/30 text-accent-teal text-xs font-semibold">
              <ShieldCheck size={14} />
              Painel do Moderador
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-light-text-main dark:text-text-main tracking-tight">
              Gestão Operacional & Ingestão
            </h1>
            <p className="text-light-text-muted dark:text-text-muted text-xs sm:text-sm max-w-2xl">
              Alimente a base de dados via planilhas ou sincronize com o Databricks para atualizar as pontuações e metas dos técnicos na campanha Brilha+.
            </p>
          </div>

          {/* Botão Auxiliar de Recálculo Rápido */}
          <div className="flex items-center shrink-0">
            <button
              onClick={handleRecalcularCampanha}
              disabled={recalculating}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-light-borderStrong dark:border-border hover:border-accent-teal/40 text-xs font-bold text-light-text-main dark:text-slate-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Executa o motor analítico e atualiza a campanha."
            >
              <BarChart3 size={15} className={`text-accent-teal ${recalculating ? 'animate-pulse' : ''}`} />
              {recalculating ? 'Atualizando Campanha...' : 'Atualizar Campanha'}
            </button>
          </div>
        </div>

        {/* Abas Principais */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/80 border border-light-borderStrong dark:border-border/80 rounded-2xl w-fit flex-wrap">
          <button
            onClick={() => handleTabChange('UPLOADS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'UPLOADS'
                ? 'bg-accent-teal text-[#0f172a] shadow-md shadow-accent-teal/20'
                : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <DatabaseZap size={16} />
            Ingestão de Dados
          </button>
          <button
            onClick={() => handleTabChange('TECNICOS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'TECNICOS'
                ? 'bg-accent-teal text-[#0f172a] shadow-md shadow-accent-teal/20'
                : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Users size={16} />
            Gestão de Usuários
          </button>
          <button
            onClick={() => handleTabChange('CAMPANHA')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === 'CAMPANHA'
                ? 'bg-accent-teal text-[#0f172a] shadow-md shadow-accent-teal/20'
                : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck size={16} />
            Gestão de Campanha
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div>
        {activeTab === 'UPLOADS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
            
            {/* Seletor Enxuto de Modo de Ingestão: Planilhas vs. Databricks */}
            <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-light-surface dark:bg-surface rounded-2xl border border-light-borderStrong dark:border-border shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-accent-teal/10 text-accent-teal">
                  <Layers size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-light-text-main dark:text-text-main">Modo de Ingestão de Dados</h2>
                  <p className="text-xs text-light-text-muted dark:text-text-muted">Selecione o canal para carregar os chamados e indicadores</p>
                </div>
              </div>

              {/* Botões Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-light-borderStrong dark:border-border">
                <button
                  onClick={() => handleModeChange('planilhas')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ingestMode === 'planilhas'
                      ? 'bg-accent-teal text-[#0f172a] shadow-md shadow-accent-teal/20'
                      : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white'
                  }`}
                >
                  <FileSpreadsheet size={15} />
                  Adicionar Planilhas (Excel/CSV)
                </button>
                <button
                  onClick={() => handleModeChange('databricks')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ingestMode === 'databricks'
                      ? 'bg-accent-teal text-[#0f172a] shadow-md shadow-accent-teal/20'
                      : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white'
                  }`}
                >
                  <Server size={15} />
                  Sincronia Databricks (DataLake)
                </button>
              </div>
            </div>

            {/* MODO 1: INGESTÃO POR PLANILHAS EXCEL / CSV */}
            {ingestMode === 'planilhas' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                {/* Banner Orientativo */}
                <div className="p-4 bg-accent-teal/5 border border-accent-teal/20 rounded-2xl flex items-start gap-3 text-xs text-light-text-muted dark:text-slate-300">
                  <Sparkles size={18} className="text-accent-teal shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong className="text-accent-teal font-semibold">Processamento Inteligente com Auto-Recálculo:</strong>
                    <p className="opacity-90">
                      Faça o upload das planilhas abaixo. Os dados serão validados, vinculados automaticamente aos técnicos e bases ATP e o motor de cálculo atualizará as pontuações dos técnicos e os indicadores da campanha.
                    </p>
                  </div>
                </div>

                {/* Grid dos 4 Cards de Upload de Planilha em Layout Amplo (2x2) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                  {/* 1. SLA */}
                  <UploadCard 
                    type="BaseDL"
                    title="SLA"
                    subtitle="Base de chamados atendidos que compõe o SLA"
                    description="Planilha principal para apuração de SLA e atendimentos fechados no período, vinculando técnicos e bases de atendimento."
                    columnsExpected={[
                      'Chamado', 'Projeto', 'FT', 'SLA_status', 'Equipamento',
                      'Material_descricao', 'Comercial', 'Assistencia_centro_trabalho',
                      'Assistencia_nome', 'Tecnico_nome', 'Texto_encerrado', 'Reincidente', 'Classifica_chamado'
                    ]}
                    state={uploadStates.BaseDL}
                    onUpload={handleSpreadsheetUpload}
                  />

                  {/* 2. Consumo de Peças */}
                  <UploadCard 
                    type="Parts"
                    title="Consumo de Peças"
                    subtitle="Peças Elegíveis da Campanha"
                    description="Planilha para cálculo de peças utilizadas de acordo com o grupo específico e válido (SSD, HD, HDD, LCD, Placa mãe)."
                    columnsExpected={[
                      'chamado', 'ct', 'atp', 'ft', 'segmento',
                      'projeto', 'equipamento', 'sintoma', 'tecnico_nome', 'subgrupo', 'acao'
                    ]}
                    state={uploadStates.Parts}
                    onUpload={handleSpreadsheetUpload}
                  />

                  {/* 3. Reincidências */}
                  <UploadCard 
                    type="Reincidencia"
                    title="Reincidências"
                    subtitle="Chamados com Reincidência Gerada"
                    description="Chamados encerrados e que geraram reincidência (RRC vs. Anterior), relacionando defeitos, laudos e peças aplicadas."
                    columnsExpected={[
                      'chamado_anterior', 'chamado_rrc', 'ft_anterior', 'ft_rrc', 'encerramento_rrc',
                      'classificacao', 'defeito_anterior', 'aplicado_peca_anterior', 'segmento_rrc',
                      'ct_rrc', 'ct_anterior', 'tecnico_nome_anterior', 'tecnico_nome_rrc', 'motivo_class'
                    ]}
                    state={uploadStates.Reincidencia}
                    onUpload={handleSpreadsheetUpload}
                  />

                  {/* 4. Encerrados RRC */}
                  <UploadCard 
                    type="EncerradosRRC"
                    title="Encerrados RRC"
                    subtitle="Reincidências encerradas"
                    description="Aqui estão os chamados abertos, atendidos e encerrados por causa da reincidência."
                    columnsExpected={[
                      'chamado', 'segmento', 'projeto', 'assistencia_codigo',
                      'assistencia_nome', 'ft', 'tecnico_nome', 'texto_encerrado'
                    ]}
                    state={uploadStates.EncerradosRRC}
                    onUpload={handleSpreadsheetUpload}
                  />
                </div>
              </div>
            )}

            {/* MODO 2: SINCRONIA DATABRICKS (DATALAKE) */}
            {ingestMode === 'databricks' && (
              <div className="bg-light-surface dark:bg-surface rounded-3xl p-6 sm:p-8 border border-light-borderStrong dark:border-border shadow-xl space-y-6 animate-in fade-in duration-200">
                
                {/* Header Databricks */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/10 border border-accent-teal/30 text-accent-teal text-xs font-semibold">
                      <Server size={14} />
                      Databricks SQL Warehouse
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-light-text-main dark:text-text-main tracking-tight flex items-center gap-2.5">
                      <Cpu className="text-accent-teal shrink-0" size={26} />
                      Sincronização por Período
                    </h2>
                    <p className="text-light-text-muted dark:text-text-muted text-xs sm:text-sm">
                      Extrai dados de chamados, reincidências e peças diretamente do Datalake corporativo.
                    </p>
                  </div>

                  <div className="flex items-center shrink-0">
                    <button
                      onClick={handleDatabricksSync}
                      disabled={tracker.status === 'processing'}
                      className="px-6 py-3 rounded-xl bg-accent-teal hover:bg-accent-teal/90 text-[#0f172a] font-bold text-xs sm:text-sm shadow-lg shadow-accent-teal/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <RefreshCw size={16} className={tracker.status === 'processing' ? 'animate-spin' : ''} />
                      {tracker.status === 'processing' ? 'Sincronizando...' : 'Sincronizar Agora'}
                    </button>
                  </div>
                </div>

                {/* Filtro de Período */}
                <div className="p-5 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-light-borderStrong dark:border-border/60 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2 font-bold text-light-text-main dark:text-text-main text-xs">
                      <Filter className="text-accent-teal" size={16} />
                      Filtro Temporal
                    </div>

                    <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-950/80 border border-light-borderStrong dark:border-border p-1 rounded-xl">
                      <button
                        onClick={() => setPeriodMode('BIMESTRE')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          periodMode === 'BIMESTRE' 
                            ? 'bg-accent-teal text-[#0f172a] font-bold shadow-sm' 
                            : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white'
                        }`}
                      >
                        Seleção Bimestral
                      </button>
                      <button
                        onClick={() => setPeriodMode('CUSTOM')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          periodMode === 'CUSTOM' 
                            ? 'bg-accent-teal text-[#0f172a] font-bold shadow-sm' 
                            : 'text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-white'
                        }`}
                      >
                        Data Personalizada
                      </button>
                    </div>
                  </div>

                  {periodMode === 'BIMESTRE' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
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
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-accent-teal/10 border-accent-teal text-accent-teal ring-1 ring-accent-teal/40'
                                : 'bg-light-surface dark:bg-slate-950/40 border-light-borderStrong dark:border-border/60 text-light-text-muted dark:text-text-muted hover:border-accent-teal/40'
                            }`}
                          >
                            <div className={`text-xs font-bold ${isSelected ? 'text-accent-teal' : 'text-light-text-main dark:text-slate-200'}`}>{bim.label}</div>
                            <div className="text-[10px] opacity-75 mt-0.5">{bim.period}</div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted flex items-center gap-1">
                          <Calendar size={14} className="text-accent-teal" /> Início:
                        </label>
                        <input
                          type="date"
                          value={customDataInicio}
                          onChange={(e) => setCustomDataInicio(e.target.value)}
                          className="px-3 py-1.5 bg-light-surface dark:bg-slate-950 border border-light-borderStrong dark:border-border rounded-xl text-xs font-semibold text-light-text-main dark:text-text-main outline-none focus:border-accent-teal"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-light-text-muted dark:text-text-muted flex items-center gap-1">
                          <Calendar size={14} className="text-accent-teal" /> Fim:
                        </label>
                        <input
                          type="date"
                          value={customDataFim}
                          onChange={(e) => setCustomDataFim(e.target.value)}
                          className="px-3 py-1.5 bg-light-surface dark:bg-slate-950 border border-light-borderStrong dark:border-border rounded-xl text-xs font-semibold text-light-text-main dark:text-text-main outline-none focus:border-accent-teal"
                        />
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-accent-teal font-medium flex items-center gap-2 pt-2 border-t border-light-borderStrong dark:border-border/60">
                    <span className="text-light-text-muted dark:text-text-muted">Intervalo:</span>
                    <span className="bg-accent-teal/10 border border-accent-teal/30 text-accent-teal px-2 py-0.5 rounded-md font-mono font-bold text-xs">
                      {formatDateBR(activeDates.data_inicio)} até {formatDateBR(activeDates.data_fim)}
                    </span>
                  </div>
                </div>

                {/* Status Global em Processamento */}
                {tracker.status === 'processing' && (
                  <div className="p-4 bg-accent-teal/10 border border-accent-teal/30 rounded-2xl space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                      <span className="text-accent-teal flex items-center gap-2">
                        <Loader2 className="animate-spin text-accent-teal shrink-0" size={16} />
                        {tracker.step}
                      </span>
                      <span className="text-accent-teal font-mono">{tracker.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-900 rounded-full h-2 overflow-hidden border border-accent-teal/20">
                      <div
                        className="h-full bg-gradient-to-r from-accent-teal to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${tracker.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-light-text-muted dark:text-text-muted">
                      <span className="flex items-center gap-1 text-accent-teal">
                        <Clock size={12} />
                        Restante: <strong className="font-mono text-light-text-main dark:text-white">{formatDuration(tracker.estimated_seconds_remaining)}</strong>
                      </span>
                      <span>Tabela atual: <strong className="text-light-text-main dark:text-white font-mono">{formatTableName(tracker.current_table)}</strong></span>
                    </div>
                  </div>
                )}

                {/* Grid dos 3 Cards de Status das Tabelas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* 1. Chamados */}
                  {(() => {
                    const isDone = tracker.tables?.chamados?.status === 'success';
                    const isProc = tracker.tables?.chamados?.status === 'processing';
                    const rowCount = tracker.tables?.chamados?.rows || 0;
                    return (
                      <div className="p-4 bg-slate-100/60 dark:bg-slate-900/60 rounded-2xl border border-light-borderStrong dark:border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isDone ? 'bg-emerald-500/10 text-emerald-400' : isProc ? 'bg-accent-teal/10 text-accent-teal' : 'bg-slate-200/60 dark:bg-slate-800 text-light-text-muted'}`}>
                            <Table size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-light-text-main dark:text-text-main">Chamados</h4>
                            <p className="text-[11px] text-light-text-muted dark:text-text-muted">{isDone ? `${rowCount.toLocaleString('pt-BR')} registros` : 'SLA & Atendimentos'}</p>
                          </div>
                        </div>
                        {isDone && <CheckCircle className="text-emerald-400 shrink-0" size={16} />}
                        {isProc && <Loader2 className="text-accent-teal animate-spin shrink-0" size={16} />}
                      </div>
                    );
                  })()}

                  {/* 2. Reincidências */}
                  {(() => {
                    const isDone = tracker.tables?.reincidentes?.status === 'success';
                    const isProc = tracker.tables?.reincidentes?.status === 'processing';
                    const rowCount = tracker.tables?.reincidentes?.rows || 0;
                    return (
                      <div className="p-4 bg-slate-100/60 dark:bg-slate-900/60 rounded-2xl border border-light-borderStrong dark:border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isDone ? 'bg-emerald-500/10 text-emerald-400' : isProc ? 'bg-accent-teal/10 text-accent-teal' : 'bg-slate-200/60 dark:bg-slate-800 text-light-text-muted'}`}>
                            <RefreshCw size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-light-text-main dark:text-text-main">Reincidências</h4>
                            <p className="text-[11px] text-light-text-muted dark:text-text-muted">{isDone ? `${rowCount.toLocaleString('pt-BR')} registros` : 'Voltas RRC'}</p>
                          </div>
                        </div>
                        {isDone && <CheckCircle className="text-emerald-400 shrink-0" size={16} />}
                        {isProc && <Loader2 className="text-accent-teal animate-spin shrink-0" size={16} />}
                      </div>
                    );
                  })()}

                  {/* 3. Peças */}
                  {(() => {
                    const isDone = tracker.tables?.pecas?.status === 'success';
                    const isProc = tracker.tables?.pecas?.status === 'processing';
                    const rowCount = tracker.tables?.pecas?.rows || 0;
                    return (
                      <div className="p-4 bg-slate-100/60 dark:bg-slate-900/60 rounded-2xl border border-light-borderStrong dark:border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isDone ? 'bg-emerald-500/10 text-emerald-400' : isProc ? 'bg-accent-teal/10 text-accent-teal' : 'bg-slate-200/60 dark:bg-slate-800 text-light-text-muted'}`}>
                            <DatabaseZap size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-light-text-main dark:text-text-main">Consumo de Peças</h4>
                            <p className="text-[11px] text-light-text-muted dark:text-text-muted">{isDone ? `${rowCount.toLocaleString('pt-BR')} registros` : 'Peças Aplicadas'}</p>
                          </div>
                        </div>
                        {isDone && <CheckCircle className="text-emerald-400 shrink-0" size={16} />}
                        {isProc && <Loader2 className="text-accent-teal animate-spin shrink-0" size={16} />}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'TECNICOS' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <TecnicosManager />
          </div>
        )}

        {activeTab === 'CAMPANHA' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <CampaignManager />
          </div>
        )}
      </div>
    </div>
  );
}
