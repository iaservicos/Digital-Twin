import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

import { TecnicoMetricsUI } from '../components/dashboard/TecnicoMetricsUI';
import { useTecnicoMetrics } from '../hooks/useTecnicoMetrics';
import { useCampanhaStore } from '../store/campanhaStore';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const [rankingOriginal, setRankingOriginal] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('Média Final');
  const [selectedMatricula, setSelectedMatricula] = useState<string>('');
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

          // Se o usuário tiver matrícula no ranking, seleciona ela; caso contrário (ex: ADMIN), seleciona o líder do ranking
          const userInRanking = response.data.find((r: any) => 
            (r.matricula && user?.matricula && String(r.matricula) === String(user.matricula)) ||
            (r.tecnico && user?.nomeCompleto && String(r.tecnico).toUpperCase() === String(user.nomeCompleto).toUpperCase())
          );

          if (userInRanking) {
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
  }, [user]);

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
        <div className="flex flex-wrap items-center justify-between gap-3 bg-light-surface dark:bg-surface/50 border border-light-borderStrong dark:border-border rounded-2xl px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
              Modo Gestor
            </span>
            <span className="text-xs text-light-text-secondary dark:text-text-muted font-medium">
              Inspecionando Técnico:
            </span>
          </div>
          <select
            value={activeMatricula}
            onChange={(e) => setSelectedMatricula(e.target.value)}
            className="bg-light-background dark:bg-surface text-light-text-main dark:text-text-main text-xs font-bold rounded-xl px-3 py-1.5 border border-light-borderStrong dark:border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {rankingOriginal.map((r: any) => (
              <option key={r.matricula || r.idTecnico} value={String(r.matricula)}>
                {r.tecnico} ({r.pontosTotal || 0} pts) - {r.localEquipe || 'Base'}
              </option>
            ))}
          </select>
        </div>
      )}

      <TecnicoMetricsUI 
        metricas={metricas}
        displayMetricas={displayMetricas}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
      />
    </div>
  );
}
