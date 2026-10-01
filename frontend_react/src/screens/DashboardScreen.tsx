import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

import { TecnicoMetricsUI } from '../components/dashboard/TecnicoMetricsUI';
import { useTecnicoMetrics } from '../hooks/useTecnicoMetrics';
import { useCampanhaStore } from '../store/campanhaStore';
import { TechnicianSearchSelect } from '../components/dashboard/TechnicianSearchSelect';
import { SegmentoFilterPill, SegmentoType } from '../components/common/SegmentoFilterPill';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const [rankingOriginal, setRankingOriginal] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('Média Final');
  const [selectedMatricula, setSelectedMatricula] = useState<string>('');
  const [selectedSegmento, setSelectedSegmento] = useState<SegmentoType>('Total');
  const [loading, setLoading] = useState(true);

  const isSupervisorOrAdmin = ['SUPERVISOR', 'MODERADOR', 'ADMIN', 'ROLE_SUPERVISOR', 'ROLE_MODERADOR', 'ROLE_ADMIN'].includes((user?.role || '').toUpperCase());

  useEffect(() => {
    let mounted = true;

    const fetchMetricas = async () => {
      try {
        const { selectedCampanha } = useCampanhaStore.getState();
        const query = selectedCampanha ? `?mesAno=${selectedCampanha.dataFim}` : '';

        // Carrega dados oficiais do ranking
        const response = await api.get(`/dashboard/ranking${query}`);
        if (mounted && response.data) {
          setRankingOriginal(response.data);

          // Se o usuário tiver matrícula no ranking
          const userInRanking = response.data.find((r: any) => 
            (r.matricula && user?.matricula && String(r.matricula) === String(user.matricula)) ||
            (r.tecnico && user?.nomeCompleto && String(r.tecnico).toUpperCase() === String(user.nomeCompleto).toUpperCase())
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
        if (mounted) setLoading(false);
      }
    };

    fetchMetricas();

    return () => {
      mounted = false;
    };
  }, [user, isSupervisorOrAdmin]);

  // Lista com todos os técnicos visíveis do ranking
  const tecnicosVisiveis = useMemo(() => {
    return rankingOriginal.map((r: any) => ({
      idTecnico: r.idTecnico,
      matricula: String(r.matricula || ''),
      nomeCompleto: r.tecnico || r.nomeCompleto,
      ctBases: r.localEquipe ? [r.localEquipe] : []
    }));
  }, [rankingOriginal]);

  const activeMatricula = selectedMatricula || (user?.matricula ? String(user.matricula) : '');

  const { metricas, displayMetricas } = useTecnicoMetrics(
    rankingOriginal,
    tecnicosVisiveis,
    activeMatricula,
    selectedMonth
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
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
  );
}
