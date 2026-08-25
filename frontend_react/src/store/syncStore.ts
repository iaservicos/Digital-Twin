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
  tickSeconds: () => void;
}

const getPythonHeaders = () => {
  const apiKey = import.meta.env.VITE_DATA_INGEST_API_KEY || 'pos-data-token-2026';
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };
};

const getPythonApiUrl = () => {
  const envUrl = import.meta.env.VITE_DATA_INGEST_URL || import.meta.env.VITE_PYTHON_API_URL;
  if (envUrl) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://digitaltwin-dataingest.onrender.com';
  }
  return 'http://localhost:8000';
};

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
      const pythonApiUrl = getPythonApiUrl();
      const pythonRes = await axios.get(`${pythonApiUrl}/api/v1/sync/status`, {
        headers: getPythonHeaders(),
        timeout: 3000
      }).catch(() => null);

      if (pythonRes?.data) {
        const data = pythonRes.data;
        if (data.status === 'processing') {
          set({ tracker: data, isWidgetDismissed: false });
        } else if (data.status === 'success' || data.status === 'failed') {
          if (get().tracker.status === 'processing') {
            set({ tracker: data });
          }
        }
      }
    } catch (err) {
      console.error('Erro ao consultar status da sincronização:', err);
    }
  },

  triggerSync: async (data_inicio: string, data_fim: string) => {
    set({
      isWidgetDismissed: false,
      tracker: {
        ...initialTracker,
        status: 'processing',
        progress: 5,
        step: `Conectando ao Databricks SQL Warehouse (${data_inicio} até ${data_fim})...`,
        estimated_seconds_remaining: 30,
        periodo: { data_inicio, data_fim }
      }
    });

    try {
      const pythonApiUrl = getPythonApiUrl();
      await axios.post(
        `${pythonApiUrl}/api/v1/sync`,
        { data_inicio, data_fim },
        { headers: getPythonHeaders() }
      );
    } catch (error: any) {
      console.error('Erro ao disparar sincronização:', error);
      set({
        tracker: {
          ...initialTracker,
          status: 'failed',
          progress: 0,
          step: 'Erro ao conectar ao microserviço DataIngest.',
          error: error.response?.data?.detail || error.message || 'Servidor offline'
        }
      });
    }
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
        `${pythonApiUrl}/api/v1/calculo/geral?mes=${mes}&ano=${ano}`,
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
