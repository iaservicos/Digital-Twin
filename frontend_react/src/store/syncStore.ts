import { create } from 'zustand';
import axios from 'axios';
import { api } from '../services/api';

export interface TableStatus {
  status: 'pending' | 'processing' | 'success' | 'failed';
  rows: number;
  seconds?: number;
}

export interface SyncTracker {
  status: 'idle' | 'processing' | 'success' | 'failed';
  progress: number;
  step: string;
  current_table: string | null;
  tables: {
    chamados: TableStatus;
    reincidentes: TableStatus;
    pecas: TableStatus;
  };
  estimated_seconds_remaining: number;
  elapsed_seconds: number;
  total_rows: number;
  error?: string | null;
  periodo?: {
    data_inicio: string | null;
    data_fim: string | null;
  };
  start_timestamp?: string | null;
}

interface SyncStore {
  tracker: SyncTracker;
  isWidgetDismissed: boolean;
  dismissWidget: () => void;
  resetWidget: () => void;
  fetchStatus: () => Promise<void>;
  triggerSync: (data_inicio: string, data_fim: string) => Promise<void>;
  triggerCampaignRecalculation: (apiToken: string | null) => Promise<void>;
  triggerIncrementalCampaignSync: () => Promise<void>;
  triggerFullCampaignSync: () => Promise<void>;
  executeStepPipeline: (data_inicio?: string, data_fim?: string) => Promise<void>;
  tickSeconds: () => void;
}

export const getPythonHeaders = () => {
  const apiKey = (import.meta.env.VITE_DATA_INGEST_API_KEY || '').trim() || 'pos-data-token-2026';
  return {
    'X-API-Key': apiKey,
  };
};

// URL para leitura de status: sempre na Vercel / mesma origem para resposta instantanea (< 100ms) sem acordar o Render
export const getStatusApiUrl = () => {
  return '';
};

// URL para acoes pesadas de ingestao do Moderador: direciona para o DataIngest no Render
export const getDataIngestApiUrl = () => {
  const envUrl = (import.meta.env.VITE_DATA_INGEST_URL || '').trim();
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }
  // Em produção (domínio web oficial), caso a variável não tenha sido embutida no build da Vercel:
  if (typeof window !== 'undefined' && window.location.hostname && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    return 'https://digitaltwin-dataingest.onrender.com';
  }
  return '';
};

// Compatibilidade retroativa
export const getPythonApiUrl = getDataIngestApiUrl;

const initialTracker: SyncTracker = {
  status: 'idle',
  progress: 0,
  step: 'Pronto para iniciar',
  current_table: null,
  tables: {
    chamados: { status: 'pending', rows: 0 },
    reincidentes: { status: 'pending', rows: 0 },
    pecas: { status: 'pending', rows: 0 }
  },
  estimated_seconds_remaining: 0,
  elapsed_seconds: 0,
  total_rows: 0,
  error: null
};

export const useSyncStore = create<SyncStore>((set, get) => ({
  tracker: initialTracker,
  isWidgetDismissed: false,

  dismissWidget: () => set({ isWidgetDismissed: true }),
  resetWidget: () => set({ tracker: initialTracker, isWidgetDismissed: false }),

  // Ticker de 1 segundo para contagem regressiva em tempo real no frontend
  tickSeconds: () => {
    const current = get().tracker;
    if (current.status === 'processing') {
      set({
        tracker: {
          ...current,
          elapsed_seconds: Number((current.elapsed_seconds + 1).toFixed(1)),
          estimated_seconds_remaining: Math.max(0, current.estimated_seconds_remaining - 1)
        }
      });
    }
  },

  fetchStatus: async () => {
    try {
      const statusApiUrl = getStatusApiUrl();
      const pythonRes = await axios.get(`${statusApiUrl}/api/v1/sync/status`, {
        headers: getPythonHeaders(),
        timeout: 10000
      }).catch(() => null);

      if (pythonRes?.data) {
        const data = pythonRes.data;
        if (data.status === 'processing') {
          set({ tracker: data, isWidgetDismissed: false });
        } else if (data.status === 'success' || data.status === 'failed') {
          set({ tracker: data });
        }
      }
    } catch (err) {
      console.error('Erro ao consultar status da sincronização:', err);
    }
  },

  executeStepPipeline: async (data_inicio?: string, data_fim?: string) => {
    const pythonApiUrl = getPythonApiUrl();
    const headers = getPythonHeaders();
    const payload = { data_inicio: data_inicio || null, data_fim: data_fim || null };

    set({
      isWidgetDismissed: false,
      tracker: {
        ...initialTracker,
        status: 'processing',
        progress: 5,
        step: 'Conectando ao Databricks SQL Warehouse...',
        estimated_seconds_remaining: 35,
        periodo: { data_inicio: data_inicio || null, data_fim: data_fim || null }
      }
    });

    try {
      // 1. Etapa de Chamados (~8s)
      set({
        tracker: {
          ...get().tracker,
          progress: 15,
          step: 'Extraindo e gravando Chamados (1/4)...',
          current_table: 'Chamados',
          estimated_seconds_remaining: 25,
          tables: {
            ...get().tracker.tables,
            chamados: { status: 'processing', rows: 0, seconds: 0 }
          }
        }
      });
      const resChamados = await axios.post(`${pythonApiUrl}/api/v1/sync/step/chamados`, payload, { headers, timeout: 60000 });
      const rowsChamados = resChamados.data?.summary?.total_rows || 0;
      const secChamados = resChamados.data?.summary?.elapsed_seconds || 8;
      set({
        tracker: {
          ...get().tracker,
          progress: 35,
          tables: {
            ...get().tracker.tables,
            chamados: { status: 'success', rows: rowsChamados, seconds: secChamados }
          }
        }
      });

      // 2. Etapa de Reincidências (~4s)
      set({
        tracker: {
          ...get().tracker,
          progress: 45,
          step: 'Extraindo e gravando Reincidências (2/4)...',
          current_table: 'Reincidências',
          estimated_seconds_remaining: 18,
          tables: {
            ...get().tracker.tables,
            reincidentes: { status: 'processing', rows: 0, seconds: 0 }
          }
        }
      });
      const resReinc = await axios.post(`${pythonApiUrl}/api/v1/sync/step/reincidentes`, payload, { headers, timeout: 60000 });
      const rowsReinc = resReinc.data?.summary?.total_rows || 0;
      const secReinc = resReinc.data?.summary?.elapsed_seconds || 4;
      set({
        tracker: {
          ...get().tracker,
          progress: 65,
          tables: {
            ...get().tracker.tables,
            reincidentes: { status: 'success', rows: rowsReinc, seconds: secReinc }
          }
        }
      });

      // 3. Etapa de Peças (~10s via COPY)
      set({
        tracker: {
          ...get().tracker,
          progress: 75,
          step: 'Extraindo e gravando Peças (3/4)...',
          current_table: 'Peças',
          estimated_seconds_remaining: 15,
          tables: {
            ...get().tracker.tables,
            pecas: { status: 'processing', rows: 0, seconds: 0 }
          }
        }
      });
      const resPecas = await axios.post(`${pythonApiUrl}/api/v1/sync/step/pecas`, payload, { headers, timeout: 60000 });
      const rowsPecas = resPecas.data?.summary?.total_rows || 0;
      const secPecas = resPecas.data?.summary?.elapsed_seconds || 10;
      set({
        tracker: {
          ...get().tracker,
          progress: 88,
          tables: {
            ...get().tracker.tables,
            pecas: { status: 'success', rows: rowsPecas, seconds: secPecas }
          }
        }
      });

      // 4. Etapa de Consolidação & Recálculo (~12s)
      set({
        tracker: {
          ...get().tracker,
          progress: 92,
          step: 'Recalculando matriz analítica e indicadores oficiais (4/4)...',
          current_table: 'Cálculo Analítico',
          estimated_seconds_remaining: 5
        }
      });
      await axios.post(`${pythonApiUrl}/api/v1/sync/step/consolidar`, payload, { headers, timeout: 60000 });

      // Sucesso Total!
      const totalRowsAll = rowsChamados + rowsReinc + rowsPecas;
      set({
        tracker: {
          ...get().tracker,
          status: 'success',
          progress: 100,
          step: 'Sincronização concluída com sucesso! Todos os indicadores foram atualizados.',
          current_table: null,
          estimated_seconds_remaining: 0,
          total_rows: totalRowsAll
        }
      });
      await get().fetchStatus();
    } catch (error: any) {
      console.error('Erro no pipeline step-by-step:', error);
      let errDetail = error.response?.data?.detail || error.message || 'Falha na comunicação com o servidor';
      if (error.response?.status === 401) {
        errDetail = 'Acesso não autorizado: chave de segurança (X-API-Key) inválida ou ausente.';
      } else if (error.response?.status === 503) {
        errDetail = error.response?.data?.detail || 'Serviço de sincronização temporariamente indisponível.';
      }
      set({
        tracker: {
          ...get().tracker,
          status: 'failed',
          progress: 0,
          step: `Falha na sincronização: ${errDetail}`,
          error: errDetail,
          estimated_seconds_remaining: 0
        }
      });
      // Notifica o backend imediatamente para abortar status zumbi e quebrar loops infinitos
      try {
        await axios.post(`${pythonApiUrl}/api/v1/sync/status/abort`, { error: errDetail }, { headers, timeout: 5000 }).catch(() => null);
      } catch {}
      throw error;
    }
  },

  triggerSync: async (data_inicio: string, data_fim: string) => {
    await get().executeStepPipeline(data_inicio, data_fim);
  },

  triggerIncrementalCampaignSync: async () => {
    await get().executeStepPipeline();
  },

  triggerFullCampaignSync: async () => {
    await get().executeStepPipeline();
  },

  triggerCampaignRecalculation: async (apiToken: string | null) => {
    set({
      isWidgetDismissed: false,
      tracker: {
        ...initialTracker,
        status: 'processing',
        progress: 25,
        step: 'Iniciando apuração oficial dos 361 técnicos...',
        estimated_seconds_remaining: 5,
        elapsed_seconds: 0,
        tables: {
          chamados: { status: 'processing', rows: 361 },
          reincidentes: { status: 'pending', rows: 0 },
          pecas: { status: 'pending', rows: 0 }
        }
      }
    });

    try {
      const pythonApiUrl = getPythonApiUrl();

      let mes = 8;
      let ano = 2026;
      try {
        const campRes = await api.get('/campanha/ativa');
        if (campRes?.data?.dataFim) {
          const parts = campRes.data.dataFim.split('-');
          ano = parseInt(parts[0], 10);
          mes = parseInt(parts[1], 10);
        }
      } catch (e) {
        // Default 08/2026
      }

      set({
        tracker: {
          ...get().tracker,
          progress: 60,
          step: `Calculando matriz oficial de 6 KPIs (${String(mes).padStart(2, '0')}/${ano})...`,
          tables: {
            chamados: { status: 'success', rows: 361 },
            reincidentes: { status: 'processing', rows: 361 },
            pecas: { status: 'pending', rows: 0 }
          }
        }
      });

      await axios.post(
        `${pythonApiUrl}/api/v1/calculo/campanha`,
        {},
        { headers: getPythonHeaders() }
      );

      set({
        tracker: {
          status: 'success',
          progress: 100,
          step: 'Contabilização da campanha concluída com sucesso!',
          current_table: null,
          estimated_seconds_remaining: 0,
          elapsed_seconds: 4.5,
          total_rows: 361,
          tables: {
            chamados: { status: 'success', rows: 361 },
            reincidentes: { status: 'success', rows: 361 },
            pecas: { status: 'success', rows: 361 }
          }
        }
      });
    } catch (error: any) {
      console.error('Erro ao recalcular campanha:', error);
      set({
        tracker: {
          ...initialTracker,
          status: 'failed',
          progress: 0,
          step: 'Erro ao processar os cálculos da campanha.',
          error: error.response?.data?.detail || error.message || 'Falha no cálculo'
        }
      });
      throw error;
    }
  }
}));
