import { useMemo } from 'react';

export function useTecnicoMetrics(
  rankingOriginal: any[],
  tecnicosVisiveis: any[],
  selectedTecnicoIdentifier: string,
  selectedMonth: string
) {
  const metricas = useMemo(() => {
    if (!selectedTecnicoIdentifier || selectedTecnicoIdentifier === 'all') return null;
    
    // Procura o técnico selecionado na lista bruta
    const tecnicoInfo = tecnicosVisiveis.find(t => 
        (t.matricula && t.matricula === selectedTecnicoIdentifier) || 
        t.idTecnico?.toString() === selectedTecnicoIdentifier
    );
    if (!tecnicoInfo) return null;
    
    // Procura os resultados dele no motor de calculo
    // O motor de calculo retorna a matricula (string). 
    // Em alguns casos pode retornar String(idTecnico) como fallback se a matricula for nula.
    const rankingData = rankingOriginal.find(r => 
        (r.matricula && String(r.matricula) === selectedTecnicoIdentifier) || 
        (r.idTecnico && String(r.idTecnico) === selectedTecnicoIdentifier) ||
        (r.tecnico && String(r.tecnico).toUpperCase() === String(tecnicoInfo.nomeCompleto).toUpperCase())
    );
    
    // Se não tiver dados no ranking (ex: mes vazio ou novo tecnico), retorna um stub zerado
    if (!rankingData) {
      return {
         idTecnico: tecnicoInfo.idTecnico,
         tecnico: tecnicoInfo.nomeCompleto,
         matricula: tecnicoInfo.matricula,
         localEquipe: tecnicoInfo.ctBases ? tecnicoInfo.ctBases.join(',') : '',
         pontosTotal: 0,
         percentualSla: 0,
         pontosSla: 0,
         percentualReincidencia: 0,
         pontosReincidencia: 0,
         quantidadeProdutividade: 0,
         pontosProdutividade: 0,
         percentualEficienciaPecas: 0,
         pontosPecas: 0,
         npsScore: 0,
         pontosNps: 0,
         elegivel: false,
         motivoInelegibilidade: 'Nenhum resultado processado para o mês',
         historico: []
      };
    }
    
    return rankingData;
  }, [tecnicosVisiveis, selectedTecnicoIdentifier, rankingOriginal]);

  const displayMetricas = useMemo(() => {
    if (!metricas) return null;
    if (selectedMonth === 'Média Final') return metricas;
    const monthData = metricas.historico?.find((h: any) => h.mes === selectedMonth);
    if (!monthData) return metricas;
    return { ...metricas, ...monthData };
  }, [metricas, selectedMonth]);

  return { metricas, displayMetricas };
}
