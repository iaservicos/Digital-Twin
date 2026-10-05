import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

import { TecnicoMetricsUI } from '../components/dashboard/TecnicoMetricsUI';
import { useTecnicoMetrics } from '../hooks/useTecnicoMetrics';
import { useCampanhaStore, Campanha } from '../store/campanhaStore';
import { TechnicianSearchSelect } from '../components/dashboard/TechnicianSearchSelect';
import { SegmentoFilterPill, SegmentoType } from '../components/common/SegmentoFilterPill';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { selectedCampanha, setCampanhas, setSelectedCampanha } = useCampanhaStore();
  const [rankingOriginal, setRankingOriginal] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('Média Final');
  const [selectedMatricula, setSelectedMatricula] = useState<string>('');
  const [selectedSegmento, setSelectedSegmento] = useState<SegmentoType>('Total');
  const [loading, setLoading] = useState(true);

  const isSupervisorOrAdmin = ['SUPERVISOR', 'MODERADOR', 'ADMIN', 'ROLE_SUPERVISOR', 'ROLE_MODERADOR', 'ROLE_ADMIN'].includes((user?.role || '').toUpperCase());

  // 1. Inicializa / Sincroniza Campanhas e garante seleção de campanha ativa válida
  useEffect(() => {
    let isMounted = true;
    const syncCampanhas = async () => {
      try {
        const res = await api.get('/campanha/todas');
        if (isMounted && res.data && Array.isArray(res.data) && res.data.length > 0) {
          setCampanhas(res.data);
          const currentStored = useCampanhaStore.getState().selectedCampanha;
          const isCurrentValid = currentStored && currentStored.ativa && res.data.some((c: Campanha) => c.idCampanha === currentStored.idCampanha);
          
          if (!isCurrentValid) {
            const ativa = res.data.find((c: Campanha) => c.ativa);
            setSelectedCampanha(ativa || res.data[0]);
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar campanhas:', err);
      }
    };
    syncCampanhas();
    return () => {
      isMounted = false;
    };
  }, [setCampanhas, setSelectedCampanha]);

  // 2. Busca de Métricas e Ranking do Técnico
  const fetchMetricas = useCallback(async () => {
    try {
      setLoading(true);
      const activeCampanha = useCampanhaStore.getState().selectedCampanha;
      const query = (activeCampanha && activeCampanha.ativa && activeCampanha.dataFim)
        ? `?mesAno=${activeCampanha.dataFim}`
        : '';

      // Tenta buscar com a campanha selecionada
      let response = await api.get(`/dashboard/ranking${query}`);

      // Se retornou vazio e havia parâmetro de data, tenta fallback sem parâmetros (último mês apurado)
      if ((!response.data || response.data.length === 0) && query) {
        console.warn(`Ranking vazio para ${query}. Tentando fallback sem query...`);
        const fallbackRes = await api.get('/dashboard/ranking');
        if (fallbackRes.data && fallbackRes.data.length > 0) {
          response = fallbackRes;
        }
      }

      if (response.data && Array.isArray(response.data)) {
        setRankingOriginal(response.data);

        // Se o usuário tiver matrícula no ranking (comparação robusta case-insensitive)
        const userMat = String(user?.matricula || '').trim().toUpperCase();
        const userNome = String(user?.nomeCompleto || '').trim().toUpperCase();

        const userInRanking = response.data.find((r: any) => 
          (r.matricula && userMat && String(r.matricula).trim().toUpperCase() === userMat) ||
          (r.tecnico && userNome && String(r.tecnico).trim().toUpperCase() === userNome)
        );

        // Se for gestor (supervisor/moderador/admin) e a conta própria tiver 0 chamados/pts (ex: Márcio), 
        // inicializa no primeiro técnico do ranking para já exibir dados reais imediatamente
        if (isSupervisorOrAdmin && (!userInRanking || Number(userInRanking.pontosTotal || 0) === 0)) {
          if (response.data.length > 0) {
            setSelectedMatricula(String(response.data[0].matricula));
          }
        } else if (userInRanking) {
          setSelectedMatricula(String(userInRanking.matricula));
        } else if (response.data.length > 0) {
          setSelectedMatricula(String(response.data[0].matricula));
        }
      }
    } catch (error) {
      console.error('Erro ao buscar métricas do BD:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isSupervisorOrAdmin]);

  useEffect(() => {
    fetchMetricas();
  }, [fetchMetricas, selectedCampanha?.idCampanha, selectedCampanha?.dataFim]);

  // Lista com todos os técnicos visíveis do ranking
  const tecnicosVisiveis = useMemo(() => {
    return rankingOriginal.map((r: any) => ({
      idTecnico: r.idTecnico,
      matricula: String(r.matricula || ''),
      nomeCompleto: r.tecnico || r.nomeCompleto,
      ctBases: r.localEquipe ? [r.localEquipe] : []
    }));
  }, [rankingOriginal]);

  const activeMatricula = selectedMatricula || (user?.matricula ? String(user.matricula) : '') || (rankingOriginal[0]?.matricula ? String(rankingOriginal[0].matricula) : '');

  const { metricas, displayMetricas } = useTecnicoMetrics(
    rankingOriginal,
    tecnicosVisiveis,
    activeMatricula,
    selectedMonth
  );

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="text-xs text-light-text-secondary dark:text-text-muted font-medium">
          Carregando indicadores...
        </span>
      </div>
    );
  }

  if (rankingOriginal.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-light-surface dark:bg-surface border border-light-border dark:border-border rounded-2xl shadow-sm my-8">
        <p className="text-lg font-semibold text-light-text-main dark:text-text-main">
          Nenhuma apuração encontrada
        </p>
        <p className="text-sm mt-1 text-light-text-secondary dark:text-text-muted max-w-md">
          Não foram encontrados dados no banco para a campanha selecionada.
        </p>
        <button
          onClick={() => fetchMetricas()}
          className="mt-4 px-4 py-2 bg-primary text-black font-semibold text-xs rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-full space-y-4">
        {isSupervisorOrAdmin && rankingOriginal.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-[0.75rem] bg-light-surface dark:bg-surface/50 border border-light-borderStrong dark:border-border rounded-[1rem] px-[1rem] py-[0.625rem] shadow-sm">
            <div className="flex items-center gap-[0.5rem]">
              <span className="text-[0.625rem] font-bold text-primary uppercase tracking-wider bg-primary/10 px-[0.5rem] py-[0.125rem] rounded-[0.375rem] border border-primary/20">
                Modo Gestor
              </span>
              <span className="text-[0.75rem] text-light-text-secondary dark:text-text-muted font-medium">
                Inspecionando Técnico:
              </span>
            </div>

            {/* Seletor Global de Segmento [ Total | Gov | Corp ] conforme dashboard5.excalidraw */}
            <SegmentoFilterPill
              value={selectedSegmento}
              onChange={setSelectedSegmento}
            />

            <TechnicianSearchSelect
              ranking={rankingOriginal}
              selectedMatricula={activeMatricula}
              defaultMatricula={user?.matricula ? String(user.matricula) : (rankingOriginal[0]?.matricula ? String(rankingOriginal[0].matricula) : '')}
              defaultLabel={user?.matricula ? '✨ Meu Perfil (Técnico Logado)' : '✨ Primeiro do Ranking'}
              onSelect={setSelectedMatricula}
            />
          </div>
        )}

        <TecnicoMetricsUI 
          metricas={metricas}
          displayMetricas={displayMetricas}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedSegmento={selectedSegmento}
          setSelectedSegmento={setSelectedSegmento}
        />
      </div>
    </ErrorBoundary>
  );
}
