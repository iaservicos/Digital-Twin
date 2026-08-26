import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

import { TecnicoMetricsUI } from '../components/dashboard/TecnicoMetricsUI';
import { useTecnicoMetrics } from '../hooks/useTecnicoMetrics';
import { useCampanhaStore } from '../store/campanhaStore';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const [rankingOriginal, setRankingOriginal] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('Média Final');
  const [loading, setLoading] = useState(true);

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

  // Obter idTecnico real do ranking ou do authStore
  const foundRanking = rankingOriginal.find((r: any) => 
    (r.matricula && user?.matricula && String(r.matricula) === String(user.matricula)) ||
    (r.tecnico && user?.nomeCompleto && String(r.tecnico).toUpperCase() === String(user.nomeCompleto).toUpperCase())
  );

  const realIdTecnico = foundRanking?.idTecnico || (user as any)?.id || (user as any)?.idTecnico || 0;

  const myTecnicoInfo = user ? [{
    idTecnico: realIdTecnico,
    matricula: user.matricula,
    nomeCompleto: user.nomeCompleto,
    ctBases: user.localEquipe ? [user.localEquipe] : []
  }] : [];

  const { metricas, displayMetricas } = useTecnicoMetrics(
    rankingOriginal,
    myTecnicoInfo,
    user?.matricula || '',
    selectedMonth
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-teal"></div>
      </div>
    );
  }

  return (
    <TecnicoMetricsUI 
      metricas={metricas}
      displayMetricas={displayMetricas}
      selectedMonth={selectedMonth}
      setSelectedMonth={setSelectedMonth}
    />
  );
}
