import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import toast from 'react-hot-toast';

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

        // 1. Carrega dados em cache para mostrar a tela rápido
        const response = await api.get(`/dashboard/ranking${query}`);
        if (mounted) setRankingOriginal(response.data);

        // 2. Dispara recálculo silencioso no background APENAS para campanha ativa
        if (user?.matricula && (!selectedCampanha || selectedCampanha.ativa)) {
          api.post(`/dashboard/calcular-tecnico?matricula=${user.matricula}`, {}, { timeout: 120000 })
            .then(async () => {
              const freshResponse = await api.get(`/dashboard/ranking${query}`);
              if (mounted) {
                setRankingOriginal(freshResponse.data);
                toast.success('Pontuação atualizada com sucesso!');
              }
            })
            .catch(e => console.error('Erro no recálculo em background:', e));
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

  // Passando tecnicosVisiveis fake contendo apenas ele mesmo,
  // pois a API já retorna todos no rankingOriginal.
  const myTecnicoInfo = user ? [{
    idTecnico: 0, // Fallback dummy
    matricula: user.matricula,
    nomeCompleto: user.nomeCompleto,
    ctBases: user.localEquipe ? user.localEquipe.split(',') : []
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
