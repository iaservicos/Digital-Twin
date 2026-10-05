import { useMemo } from 'react';

export function useTecnicoMetrics(
  rankingOriginal: any[],
  tecnicosVisiveis: any[],
  selectedTecnicoIdentifier: string,
  selectedMonth: string
) {
  const metricas = useMemo(() => {
    if (!selectedTecnicoIdentifier || selectedTecnicoIdentifier === 'all') {
      if (rankingOriginal.length > 0) {
        return rankingOriginal[0];
      }
      return null;
    }
    
    const selUpper = String(selectedTecnicoIdentifier || '').trim().toUpperCase();

    let tecnicoInfo = tecnicosVisiveis.find(t => 
        (t.matricula && String(t.matricula).trim().toUpperCase() === selUpper) || 
        t.idTecnico?.toString() === selectedTecnicoIdentifier
    );

    // Fallback: se houver técnicos visíveis
    if (!tecnicoInfo && tecnicosVisiveis.length > 0) {
      tecnicoInfo = tecnicosVisiveis[0];
    }

    if (!tecnicoInfo) {
      if (rankingOriginal.length > 0) {
        return rankingOriginal[0];
      }
      return null;
    }
    
    let rankingData = rankingOriginal.find(r => 
        (r.matricula && String(r.matricula).trim().toUpperCase() === selUpper) || 
        (r.idTecnico && String(r.idTecnico) === selectedTecnicoIdentifier) ||
        (r.tecnico && String(r.tecnico).trim().toUpperCase() === String(tecnicoInfo.nomeCompleto).trim().toUpperCase())
    );

    // Fallback: se houver dados no ranking mas não deu match exato de string
    if (!rankingData && rankingOriginal.length > 0) {
      rankingData = rankingOriginal[0];
    }
    
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
         elegivel: false,
         motivoInelegibilidade: 'Nenhum resultado processado para o mês',
         historico: []
      };
    }
    
    return rankingData;
  }, [tecnicosVisiveis, selectedTecnicoIdentifier, rankingOriginal]);

  const displayMetricas = useMemo(() => {
    const baseMetricas = metricas || (rankingOriginal.length > 0 ? rankingOriginal[0] : null);
    if (!baseMetricas) return null;
    
    const sel = (selectedMonth || '').trim().toLowerCase();
    
    // Se for Campanha Inteira / Média Final / Vazio -> Retorna a Média Consolidada da Campanha
    if (!sel || sel === 'média final' || sel === 'campanha inteira' || sel === 'campanha' || sel.includes('final')) {
      return baseMetricas;
    }
    
    // Busca no histórico do técnico pelo mês selecionado
    const monthData = baseMetricas.historico?.find((h: any) => {
      const hMes = (h.mes || '').trim().toLowerCase();
      const hRef = (h.mesReferencia || '').trim().toLowerCase();
      
      if (sel === 'julho' || sel.includes('2026-07') || sel === '7') {
        return hMes.includes('jul') || hRef.startsWith('2026-07');
      }
      if (sel === 'agosto' || sel.includes('2026-08') || sel === '8') {
        return hMes.includes('ago') || hRef.startsWith('2026-08');
      }
      if (sel === 'setembro' || sel.includes('2026-09') || sel === '9') {
        return hMes.includes('set') || hRef.startsWith('2026-09');
      }
      if (sel === 'outubro' || sel.includes('2026-10') || sel === '10') {
        return hMes.includes('out') || hRef.startsWith('2026-10');
      }
      return hMes === sel || hRef === sel || hMes.includes(sel) || hRef.includes(sel);
    });

    if (!monthData) return baseMetricas;

    return { 
      ...baseMetricas, 
      ...monthData,
      pontosTotal: monthData.pontosTotal !== undefined ? monthData.pontosTotal : baseMetricas.pontosTotal,
      percentualSla: monthData.percentualSla !== undefined ? monthData.percentualSla : baseMetricas.percentualSla,
      pontosSla: monthData.pontosSla !== undefined ? monthData.pontosSla : baseMetricas.pontosSla,
      percentualReincidencia: monthData.percentualReincidencia !== undefined ? monthData.percentualReincidencia : baseMetricas.percentualReincidencia,
      pontosReincidencia: monthData.pontosReincidencia !== undefined ? monthData.pontosReincidencia : baseMetricas.pontosReincidencia,
      percentualEficienciaPecas: monthData.percentualEficienciaPecas !== undefined ? monthData.percentualEficienciaPecas : baseMetricas.percentualEficienciaPecas,
      pontosPecas: monthData.pontosPecas !== undefined ? monthData.pontosPecas : baseMetricas.pontosPecas,
      percentualPerdidos: monthData.percentualPerdidos !== undefined ? monthData.percentualPerdidos : baseMetricas.percentualPerdidos,
      pontosPerdidos: monthData.pontosPerdidos !== undefined ? monthData.pontosPerdidos : baseMetricas.pontosPerdidos,
      elegivel: monthData.elegivel !== undefined ? monthData.elegivel : baseMetricas.elegivel,
      motivoInelegibilidade: monthData.motivoInelegibilidade || baseMetricas.motivoInelegibilidade
    };
  }, [metricas, selectedMonth, rankingOriginal]);

  return { metricas: metricas || (rankingOriginal.length > 0 ? rankingOriginal[0] : null), displayMetricas };
}
