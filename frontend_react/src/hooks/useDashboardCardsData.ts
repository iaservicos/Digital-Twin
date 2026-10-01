import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface SlaSegmentosPayload {
  total: { totalChamados: number; noPrazo: number; sla: number };
  gov: { totalChamados: number; noPrazo: number; sla: number };
  corp: { totalChamados: number; noPrazo: number; sla: number };
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface PecasDistribuicaoPayload {
  totalAtendimentos: number;
  totalPecasElegiveis: number;
  percentualConsumo: number;
  categorias: { key: string; label: string; qtd: number; pct: number }[];
}

export interface ChamadosEncerradosPayload {
  ultimoAtendimento: string | null;
  atendimentosPorDia: Record<string, number>;
  totalChamados: number;
}

interface UseDashboardCardsDataProps {
  targetTecnicoId?: number;
  idSupervisor?: number;
  selectedMonth?: string;
  equipe?: string;
  segmento?: 'Total' | 'Gov' | 'Corp';
  defaultSla?: number;
  reincidenciaMode?: 'individual' | 'equipe';
  userLocalEquipe?: string;
}

export function useDashboardCardsData({
  targetTecnicoId,
  idSupervisor,
  selectedMonth,
  equipe,
  segmento = 'Total',
  defaultSla = 0,
  reincidenciaMode = 'individual',
  userLocalEquipe
}: UseDashboardCardsDataProps) {
  // 1. SLA Segmentos
  const [slaSegmentosData, setSlaSegmentosData] = useState<SlaSegmentosPayload>({
    total: { totalChamados: 0, noPrazo: 0, sla: defaultSla },
    gov: { totalChamados: 0, noPrazo: 0, sla: defaultSla },
    corp: { totalChamados: 0, noPrazo: 0, sla: defaultSla }
  });

  // 2. Perdas Semanais
  const [perdasChartData, setPerdasChartData] = useState<ChartDataPoint[]>([
    { label: 'Sem 1', value: 0 },
    { label: 'Sem 2', value: 0 },
    { label: 'Sem 3', value: 0 },
    { label: 'Sem 4', value: 0 }
  ]);

  // 3. Reincidências Semanais
  const [reincidenciasChartData, setReincidenciasChartData] = useState<ChartDataPoint[]>([
    { label: 'Sem 1', value: 0 },
    { label: 'Sem 2', value: 0 },
    { label: 'Sem 3', value: 0 },
    { label: 'Sem 4', value: 0 }
  ]);

  // 4. Peças Distribuição
  const [pecasDistribuicao, setPecasDistribuicao] = useState<PecasDistribuicaoPayload>({
    totalAtendimentos: 0,
    totalPecasElegiveis: 0,
    percentualConsumo: 0,
    categorias: [
      { key: 'tela', label: 'Tela LCD', qtd: 0, pct: 0 },
      { key: 'ssd', label: 'SSD', qtd: 0, pct: 0 },
      { key: 'hd', label: 'HD', qtd: 0, pct: 0 },
      { key: 'plm', label: 'PLM', qtd: 0, pct: 0 }
    ]
  });

  // 5. Chamados Encerrados e Calendário
  const [chamadosData, setChamadosData] = useState<ChamadosEncerradosPayload>({
    ultimoAtendimento: null,
    atendimentosPorDia: {},
    totalChamados: 0
  });

  const [loading, setLoading] = useState(false);

  // Parâmetros comuns de filtro (mês, supervisor, equipe)
  const buildParams = useCallback(() => {
    const params: Record<string, any> = {};
    if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
      params.mesAno = selectedMonth;
    }
    if (idSupervisor !== undefined && idSupervisor !== null) {
      params.idSupervisor = idSupervisor;
    }
    if (equipe && equipe !== 'TODAS') {
      params.equipe = equipe;
    }
    if (segmento && segmento !== 'Total') {
      params.segmento = segmento;
    }
    return params;
  }, [selectedMonth, idSupervisor, equipe, segmento]);

  // Determina o endpoint base: /dashboard/tecnico/{id} ou /dashboard/tecnico/0 para supervisor
  const getTecnicoEndpointId = useCallback(() => {
    if (idSupervisor !== undefined && idSupervisor !== null) {
      return 0;
    }
    return targetTecnicoId;
  }, [idSupervisor, targetTecnicoId]);

  const fetchAllCardsData = useCallback(async () => {
    const tecId = getTecnicoEndpointId();
    if (tecId === undefined || tecId === null) return;

    setLoading(true);
    const params = buildParams();

    try {
      // 1. SLA Segmentos
      const slaPromise = api.get(`/dashboard/tecnico/${tecId}/sla-segmentos`, { params }).catch(() => null);

      // 2. Perdas Semanais
      const perdasPromise = api.get(`/dashboard/tecnico/${tecId}/perdas-semanais`, { params }).catch(() => null);

      // 3. Reincidências Semanais
      let reincEndpoint = `/dashboard/tecnico/${tecId}/reincidentes-semanais`;
      const reincParams = { ...params };
      if (reincidenciaMode === 'equipe') {
        reincEndpoint = '/dashboard/tecnico/0/reincidentes-semanais';
        if (userLocalEquipe) {
          reincParams.equipe = userLocalEquipe;
        }
      }
      const reincPromise = api.get(reincEndpoint, { params: reincParams }).catch(() => null);

      // 4. Peças Distribuição
      const pecasPromise = api.get(`/dashboard/tecnico/${tecId}/pecas-distribuicao`, { params }).catch(() => null);

      // 5. Chamados Encerrados (se for supervisor ou se endpoint estiver disponível)
      const chamadosPromise = api.get(`/dashboard/tecnico/${tecId}/chamados-encerrados`, { params }).catch(() => null);

      const [slaRes, perdasRes, reincRes, pecasRes, chamadosRes] = await Promise.all([
        slaPromise,
        perdasPromise,
        reincPromise,
        pecasPromise,
        chamadosPromise
      ]);

      if (slaRes?.data) {
        setSlaSegmentosData(slaRes.data);
      }
      if (Array.isArray(perdasRes?.data) && perdasRes.data.length > 0) {
        setPerdasChartData(perdasRes.data);
      }
      if (Array.isArray(reincRes?.data) && reincRes.data.length > 0) {
        setReincidenciasChartData(reincRes.data);
      }
      if (pecasRes?.data?.categorias && Array.isArray(pecasRes.data.categorias)) {
        setPecasDistribuicao(pecasRes.data);
      }
      if (chamadosRes?.data) {
        setChamadosData(chamadosRes.data);
      }
    } finally {
      setLoading(false);
    }
  }, [getTecnicoEndpointId, buildParams, reincidenciaMode, userLocalEquipe]);

  useEffect(() => {
    fetchAllCardsData();
  }, [fetchAllCardsData]);

  return {
    slaSegmentosData,
    perdasChartData,
    reincidenciasChartData,
    pecasDistribuicao,
    chamadosData,
    loading,
    refresh: fetchAllCardsData
  };
}
