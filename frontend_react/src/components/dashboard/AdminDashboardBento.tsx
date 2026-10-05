import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { format, parseISO } from 'date-fns';
import { useDashboardCardsData } from '../../hooks/useDashboardCardsData';
import { SegmentoType } from '../common/SegmentoFilterPill';
import {
  SlaTotalCard,
  CampanhaAtivaCard,
  ChamadosEncerradosCard,
  PerdasFalhaTecnicaCard,
  ReincidenciasCard,
  ConsumoPecasCard
} from './cards';

interface TeamSummary {
  volumeChamados: number;
  reincidenciaQtd: number;
  pecasMedia: number;
  slaMedia: number;
  perdasQtd: number;
  qtd: number;
  pontosMedia: number;
  reincidenciaMedia: number;
  perdasMedia: number;
}

interface AdminDashboardBentoProps {
  teamSummary: TeamSummary;
  selectedEquipe: string;
  selectedEquipeNome?: string;
  idSupervisor?: number | string;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedSegmento?: SegmentoType;
  setSelectedSegmento?: (seg: SegmentoType) => void;
  onOpenDetailsModal: () => void;
  onOpenSlaExplicacaoModal?: () => void;
  onOpenSlaModal: () => void;
  onOpenHistoricoModal: (date?: string) => void;
  onOpenPerdasModal: () => void;
  onOpenReincidentesModal: () => void;
  onOpenPecasModal: () => void;
}

export const AdminDashboardBento: React.FC<AdminDashboardBentoProps> = ({
  teamSummary,
  selectedEquipe,
  idSupervisor,
  selectedMonth,
  setSelectedMonth,
  selectedSegmento = 'Total',
  setSelectedSegmento,
  onOpenDetailsModal,
  onOpenSlaExplicacaoModal,
  onOpenSlaModal,
  onOpenHistoricoModal,
  onOpenPerdasModal,
  onOpenReincidentesModal,
  onOpenPecasModal
}) => {
  const percentualSla = teamSummary.slaMedia;
  const percentualReincidencia = teamSummary.reincidenciaMedia;
  const percentualPerdidos = teamSummary.perdasMedia;

  const [slaMode, setSlaMode] = useState<'individual' | 'equipe'>('equipe');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Metadados reais da campanha ativa do backend
  const [campanhaInfo, setCampanhaInfo] = useState<{
    nomeCampanha: string;
    tema: string;
    totalParticipantes: number;
    participantesAtivos: number;
    duracaoDias: number;
    diasRestantes: number;
    progressoTempo: number;
    dataInicio: string;
    dataFim: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.get('/campanha/ativa')
      .then((res) => {
        if (isMounted && res.data) {
          setCampanhaInfo(res.data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const campanhaPeriodoFormatado = useMemo(() => {
    if (campanhaInfo?.dataInicio && campanhaInfo?.dataFim) {
      try {
        const ini = format(parseISO(campanhaInfo.dataInicio), 'dd/MM');
        const fim = format(parseISO(campanhaInfo.dataFim), 'dd/MM');
        return `${ini} a ${fim}`;
      } catch {
        return '01/09 a 30/09';
      }
    }
    return '01/09 a 30/09';
  }, [campanhaInfo]);

  // Hook unificado para os dados dos 6 cards da Supervisão
  const {
    slaSegmentosData,
    perdasChartData,
    reincidenciasChartData,
    pecasDistribuicao,
    chamadosData
  } = useDashboardCardsData({
    idSupervisor: idSupervisor ? Number(idSupervisor) : 0,
    equipe: selectedEquipe !== 'all' ? selectedEquipe : undefined,
    selectedMonth,
    segmento: selectedSegmento,
    defaultSla: percentualSla,
    slaMode
  });

  const operacaoNome = useMemo(() => {
    const op = slaSegmentosData.operacao || slaSegmentosData.equipe?.operacao;
    if (!op) return '';
    if (op.rotuloCompleto) return op.rotuloCompleto;
    const partes = [];
    if (op.codigoAtp || op.ctCodigo) {
      const ufPrefix = op.uf ? `${op.uf} - ` : '';
      partes.push(`${ufPrefix}${op.codigoAtp || op.ctCodigo}`);
    }
    if (op.nomeBase) partes.push(op.nomeBase);
    else if (op.cidade && op.uf) partes.push(`${op.cidade} (${op.uf})`);
    else if (op.uf) partes.push(op.uf);
    return partes.join(' • ');
  }, [slaSegmentosData]);

  // Atualiza data selecionada padrão quando dados de chamados chegam
  useEffect(() => {
    if (chamadosData.ultimoAtendimento && !selectedDate) {
      setSelectedDate(chamadosData.ultimoAtendimento);
    }
  }, [chamadosData.ultimoAtendimento, selectedDate]);

  const mesAnoLabel = useMemo(() => {
    try {
      return selectedDate ? format(parseISO(selectedDate), 'MMMM/yyyy') : '';
    } catch {
      return '';
    }
  }, [selectedDate]);

  const perdasChartTotal = useMemo(
    () => perdasChartData.reduce((acc, c) => acc + (c.value || 0), 0),
    [perdasChartData]
  );

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* GRID BENTO: 2 COLUNAS EM TELAS INTERMEDIÁRIAS (1024px-1279px) E 3 COLUNAS EM TELAS GRANDES (≥ 1280px) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-[1rem] sm:gap-[1.25rem] xl:gap-[1.5rem]">
        {/* CARD 1: SLA total / Operação */}
        <SlaTotalCard
          slaTotal={slaSegmentosData.equipe?.total?.sla ?? slaSegmentosData.total?.sla ?? percentualSla}
          slaGov={slaSegmentosData.equipe?.gov?.sla ?? slaSegmentosData.gov?.sla}
          slaCorp={slaSegmentosData.equipe?.corp?.sla ?? slaSegmentosData.corp?.sla}
          pontosSla={teamSummary.slaMedia >= 100 ? 33.5 : teamSummary.slaMedia >= 90 ? 29.0 : 0.0}
          slaIndividualTotal={slaSegmentosData.individual?.total?.sla}
          slaIndividualGov={slaSegmentosData.individual?.gov?.sla}
          slaIndividualCorp={slaSegmentosData.individual?.corp?.sla}
          selectedSegmento={selectedSegmento}
          onSelectSegmento={setSelectedSegmento}
          canToggleMode={true}
          slaMode={slaMode}
          onToggleMode={setSlaMode}
          operacaoNome={operacaoNome}
          onOpenDetailsModal={onOpenSlaExplicacaoModal || onOpenDetailsModal}
        />

        {/* CARD 2: Campanha ativa */}
        <CampanhaAtivaCard
          campanhaInfo={campanhaInfo}
          campanhaPeriodoFormatado={campanhaPeriodoFormatado}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          percentualSla={percentualSla}
          onOpenDetailsModal={onOpenDetailsModal}
          onOpenSlaModal={onOpenDetailsModal}
        />

        {/* CARD 3: Chamados encerrados & Mini Calendário */}
        <ChamadosEncerradosCard
          mesAnoLabel={mesAnoLabel}
          chamadosData={chamadosData}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenHistoricoModal={onOpenHistoricoModal}
        />

        {/* CARD 4: Perdas - Falha técnica */}
        <PerdasFalhaTecnicaCard
          percentualPerdidos={percentualPerdidos}
          perdasQtd={selectedSegmento !== 'Total' || perdasChartTotal > 0 ? perdasChartTotal : teamSummary.perdasQtd}
          pontosPerdidos={percentualPerdidos <= 1.0 ? 21.0 : percentualPerdidos <= 2.0 ? 16.0 : 0.0}
          chartData={perdasChartData}
          onOpenPerdasModal={onOpenPerdasModal}
        />

        {/* CARD 5: Reincidências */}
        <ReincidenciasCard
          percentualReincidencia={percentualReincidencia}
          reincidenciaQtd={selectedSegmento !== 'Total' ? reincidenciasChartData.reduce((acc, c) => acc + (c.value || 0), 0) : teamSummary.reincidenciaQtd}
          pontosReincidencia={percentualReincidencia <= 7.0 ? 16.0 : percentualReincidencia <= 10.0 ? 11.0 : 0.0}
          pontosReincidenciaEquipe={percentualReincidencia <= 7.0 ? 16.0 : percentualReincidencia <= 10.0 ? 11.0 : 0.0}
          chartData={reincidenciasChartData}
          onOpenReincidentesModal={onOpenReincidentesModal}
        />

        {/* CARD 6: Consumo de peças */}
        <ConsumoPecasCard
          totalPecasElegiveis={pecasDistribuicao.totalPecasElegiveis}
          percentualConsumo={pecasDistribuicao.percentualConsumo}
          pontosPecas={pecasDistribuicao.percentualConsumo <= 25.0 ? 13.5 : 0.0}
          pecasChart={pecasDistribuicao.categorias}
          onOpenPecasModal={onOpenPecasModal}
        />
      </div>
    </div>
  );
};
