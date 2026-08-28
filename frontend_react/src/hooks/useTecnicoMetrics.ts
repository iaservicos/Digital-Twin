import { useMemo } from 'react';

export function useTecnicoMetrics(
  rankingOriginal: any[],
  tecnicosVisiveis: any[],
  selectedTecnicoIdentifier: string,
  selectedMonth: string
) {
  const metricas = useMemo(() => {
    if (!selectedTecnicoIdentifier || selectedTecnicoIdentifier === 'all') return null;
    
    const tecnicoInfo = tecnicosVisiveis.find(t => 
        (t.matricula && t.matricula === selectedTecnicoIdentifier) || 
        t.idTecnico?.toString() === selectedTecnicoIdentifier
    );
    if (!tecnicoInfo) return null;
    
    const rankingData = rankingOriginal.find(r => 
        (r.matricula && String(r.matricula) === selectedTecnicoIdentifier) || 
        (r.idTecnico && String(r.idTecnico) === selectedTecnicoIdentifier) ||
        (r.tecnico && String(r.tecnico).toUpperCase() === String(tecnicoInfo.nomeCompleto).toUpperCase())
    );
    
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
    
    const sel = (selectedMonth || '').trim().toLowerCase();
    
    // Se for Campanha Inteira / Média Final / Vazio -> Retorna a Média Consolidada da Campanha
    if (!sel || sel === 'média final' || sel === 'campanha inteira' || sel === 'campanha' || sel === '2026-08-31') {
      return metricas;
    }
    
    // Busca no histórico do técnico pelo mês selecionado
    const monthData = metricas.historico?.find((h: any) => {
      const hMes = (h.mes || '').trim().toLowerCase();
      const hRef = (h.mesReferencia || '').trim().toLowerCase();
      
      if (sel === 'julho' || sel === '2026-07-01' || sel.includes('2026-07') || sel === '7') {
        return hMes.includes('jul') || hRef.startsWith('2026-07');
      }
      if (sel === 'agosto' || sel === '2026-08-01' || sel.includes('2026-08') || sel === '8') {
        return hMes.includes('ago') || hRef.startsWith('2026-08');
      }
      return hMes === sel || hRef === sel;
    });

    if (!monthData) return metricas;

    return { 
      ...metricas, 
      ...monthData,
      pontosTotal: monthData.pontosTotal !== undefined ? monthData.pontosTotal : metricas.pontosTotal,
      percentualSla: monthData.percentualSla !== undefined ? monthData.percentualSla : metricas.percentualSla,
      percentualReincidencia: monthData.percentualReincidencia !== undefined ? monthData.percentualReincidencia : metricas.percentualReincidencia,
      percentualEficienciaPecas: monthData.percentualEficienciaPecas !== undefined ? monthData.percentualEficienciaPecas : metricas.percentualEficienciaPecas,
      percentualPerdidos: monthData.percentualPerdidos !== undefined ? monthData.percentualPerdidos : metricas.percentualPerdidos,
      npsScore: monthData.npsScore !== undefined ? monthData.npsScore : metricas.npsScore,
      elegivel: monthData.elegivel !== undefined ? monthData.elegivel : metricas.elegivel,
      motivoInelegibilidade: monthData.motivoInelegibilidade || metricas.motivoInelegibilidade
    };
  }, [metricas, selectedMonth]);

  return { metricas, displayMetricas };
}
