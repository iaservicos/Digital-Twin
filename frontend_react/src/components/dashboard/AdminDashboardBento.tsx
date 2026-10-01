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
  onOpenSlaModal,
  onOpenHistoricoModal,
  onOpenPerdasModal,
  onOpenReincidentesModal,
  onOpenPecasModal
}) => {
  const percentualSla = teamSummary.slaMedia;
  const percentualReincidencia = teamSummary.reincidenciaMedia;
  const percentualPerdidos = teamSummary.perdasMedia;

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
        const fim = format(parseISO(campanhaInfo.dataFim), 'dd/MM/yyyy');
        return `${ini} a ${fim}`;
      } catch {
        return '01/09 a 30/09/2026';
      }
    }
    return '01/09 a 30/09/2026';
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
    defaultSla: percentualSla
  });

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

  return (
    <div className="w-full space-y-[1rem]">
      {/* GRID BENTO 3 COLUNAS x 2 LINHAS REUTILIZÁVEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1.5rem]">
        {/* CARD 1: SLA total */}
        <SlaTotalCard
          slaTotal={slaSegmentosData.total?.sla ?? percentualSla}
          slaGov={slaSegmentosData.gov?.sla}
          slaCorp={slaSegmentosData.corp?.sla}
          selectedSegmento={selectedSegmento}
          onSelectSegmento={setSelectedSegmento}
          onOpenDetailsModal={onOpenDetailsModal}
        />

        {/* CARD 2: Campanha ativa */}
        <CampanhaAtivaCard
          campanhaInfo={campanhaInfo}
          campanhaPeriodoFormatado={campanhaPeriodoFormatado}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          percentualSla={percentualSla}
          onOpenSlaModal={onOpenSlaModal}
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
          perdasQtd={selectedSegmento !== 'Total' ? perdasChartData.reduce((acc, c) => acc + (c.value || 0), 0) : teamSummary.perdasQtd}
          chartData={perdasChartData}
          onOpenPerdasModal={onOpenPerdasModal}
        />

        {/* CARD 5: Reincidências */}
        <ReincidenciasCard
          percentualReincidencia={percentualReincidencia}
          reincidenciaQtd={selectedSegmento !== 'Total' ? reincidenciasChartData.reduce((acc, c) => acc + (c.value || 0), 0) : teamSummary.reincidenciaQtd}
          chartData={reincidenciasChartData}
          onOpenReincidentesModal={onOpenReincidentesModal}
        />

        {/* CARD 6: Consumo de peças */}
        <ConsumoPecasCard
          totalPecasElegiveis={pecasDistribuicao.totalPecasElegiveis}
          pecasChart={pecasDistribuicao.categorias}
          onOpenPecasModal={onOpenPecasModal}
        />
      </div>
    </div>
  );
};
