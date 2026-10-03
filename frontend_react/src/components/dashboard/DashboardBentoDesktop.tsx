import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toTitleCase, formatLocalEquipe } from '../../utils/stringFormatters';
import { Search, Bell, CheckCircle2, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useDashboardCardsData } from '../../hooks/useDashboardCardsData';
import {
  SlaTotalCard,
  CampanhaAtivaCard,
  ChamadosEncerradosCard,
  PerdasFalhaTecnicaCard,
  ReincidenciasCard,
  ConsumoPecasCard
} from './cards';
import { SegmentoFilterPill, SegmentoType } from '../common/SegmentoFilterPill';

interface DashboardBentoDesktopProps {
  metricas: any;
  displayMetricas: any;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  selectedSegmento?: SegmentoType;
  setSelectedSegmento?: (seg: SegmentoType) => void;
  onOpenDetailsModal: () => void;
  onOpenSlaModal: () => void;
  onOpenReincidentesModal: () => void;
  onOpenPecasModal: () => void;
  onOpenPerdasModal: () => void;
  onOpenHistoricoModal: (date?: string) => void;
  onOpenElegivelModal: () => void;
  onOpenInelegivelModal: () => void;
}

export const DashboardBentoDesktop: React.FC<DashboardBentoDesktopProps> = ({
  metricas,
  displayMetricas,
  selectedMonth,
  setSelectedMonth,
  selectedSegmento = 'Total',
  setSelectedSegmento,
  onOpenDetailsModal,
  onOpenSlaModal,
  onOpenReincidentesModal,
  onOpenPecasModal,
  onOpenPerdasModal,
  onOpenHistoricoModal,
  onOpenElegivelModal,
  onOpenInelegivelModal
}) => {
  const { user } = useAuthStore();
  const canToggleTeamReincidencias =
    user?.cargo === 'Administrador' ||
    user?.cargo === 'Admin' ||
    user?.cargo === 'Super Administrador' ||
    user?.role === 'ADMINISTRADOR' ||
    user?.role === 'SUPERVISOR' ||
    user?.role === 'MODERADOR';

  const isSupervisorOrAdmin = ['SUPERVISOR', 'MODERADOR', 'ADMIN', 'ROLE_SUPERVISOR', 'ROLE_MODERADOR', 'ROLE_ADMIN'].includes((user?.role || '').toUpperCase());

  const [slaMode, setSlaMode] = useState<'individual' | 'equipe'>('equipe');
  const [reincidenciaMode, setReincidenciaMode] = useState<'individual' | 'equipe'>('individual');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const percentualSla = displayMetricas.percentualSla || 0;
  const percentualReincidencia = displayMetricas.percentualReincidencia || 0;
  const percentualReincidenciaFinal =
    reincidenciaMode === 'equipe'
      ? displayMetricas.percentualReincidenciaEquipe !== undefined
        ? displayMetricas.percentualReincidenciaEquipe
        : percentualReincidencia
      : percentualReincidencia;
  const percentualPerdidos = displayMetricas.percentualPerdidos || 0;

  // Informações da campanha ativa do backend
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

  const targetTecnicoId =
    displayMetricas?.idTecnico ?? (metricas as any)?.idTecnico ?? (displayMetricas as any)?.id;

  // Hook unificado para os dados dos 6 cards
  const {
    slaSegmentosData,
    perdasChartData,
    reincidenciasChartData,
    pecasDistribuicao,
    chamadosData
  } = useDashboardCardsData({
    targetTecnicoId,
    selectedMonth,
    segmento: selectedSegmento,
    defaultSla: percentualSla,
    slaMode,
    reincidenciaMode,
    userLocalEquipe: user?.localEquipe
  });

  const operacaoNome = useMemo(() => {
    const op = slaSegmentosData.operacao || slaSegmentosData.equipe?.operacao;
    if (!op) return '';
    const partes = [];
    if (op.nomeBase) partes.push(op.nomeBase);
    if (op.cidade && op.uf) partes.push(`${op.cidade} (${op.uf})`);
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

  return (
    <div className="w-full space-y-[1.5rem]">
      {/* 1. CABEÇALHO SUPERIOR (Desktop) */}
      <header className="flex items-center justify-between gap-[1rem]">
        <div>
          <h2 className="text-[1.5rem] font-black text-light-text-main dark:text-text-main tracking-tight leading-tight">
            Dashboard de Performance
          </h2>
          <p className="text-[0.75rem] text-light-text-muted dark:text-text-muted font-medium">
            {toTitleCase(displayMetricas.tecnico) || 'Técnico'}
            {displayMetricas.localEquipe ? ` • ${formatLocalEquipe(displayMetricas.localEquipe)}` : ''}
          </p>
        </div>

        {/* Barra de Pesquisa Central */}
        <div className="flex-1 max-w-[28rem] relative">
          <Search
            size={16}
            className="absolute left-[0.875rem] top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar chamado, métrica, indicador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full glass-bento border rounded-full pl-[2.5rem] pr-[1rem] py-[0.5rem] text-[0.75rem] text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
          />
        </div>

        {/* Segmento Filter Pill no cabeçalho se não for modo gestor (para técnico direto) */}
        {!isSupervisorOrAdmin && setSelectedSegmento && (
          <SegmentoFilterPill
            value={selectedSegmento}
            onChange={setSelectedSegmento}
          />
        )}

        {/* Ações à Direita: Botão de Elegibilidade + Notificações */}
        <div className="flex items-center gap-[0.75rem]">
          {displayMetricas.elegivel ? (
            <button
              onClick={onOpenElegivelModal}
              className="flex items-center gap-[0.5rem] bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 px-[1rem] py-[0.5rem] rounded-full font-bold text-[0.75rem] transition-colors cursor-pointer shadow-sm shadow-emerald-500/10"
            >
              <CheckCircle2 size={15} />
              <span>Elegível para Premiação</span>
            </button>
          ) : (
            <button
              onClick={onOpenInelegivelModal}
              className="flex items-center gap-[0.5rem] bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20 px-[1rem] py-[0.5rem] rounded-full font-bold text-[0.75rem] transition-colors cursor-pointer shadow-sm shadow-red-500/10"
            >
              <XCircle size={15} />
              <span>Não Elegível</span>
            </button>
          )}

          <button
            className="relative p-[0.625rem] rounded-full glass-bento border text-light-text-muted dark:text-text-muted hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
            title="Notificações"
          >
            <Bell size={18} />
            <span className="absolute top-[0.375rem] right-[0.375rem] w-[0.5rem] h-[0.5rem] bg-primary rounded-full shadow-glow-primary-sm"></span>
          </button>
        </div>
      </header>

      {/* 2. GRID BENTO 3 COLUNAS x 2 LINHAS REUTILIZÁVEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1.5rem]">
        {/* CARD 1: SLA total / Operação */}
        <SlaTotalCard
          slaTotal={slaSegmentosData.equipe?.total?.sla ?? slaSegmentosData.total?.sla ?? percentualSla}
          slaGov={slaSegmentosData.equipe?.gov?.sla ?? slaSegmentosData.gov?.sla}
          slaCorp={slaSegmentosData.equipe?.corp?.sla ?? slaSegmentosData.corp?.sla}
          pontosSla={displayMetricas?.pontosSla}
          slaIndividualTotal={slaSegmentosData.individual?.total?.sla}
          slaIndividualGov={slaSegmentosData.individual?.gov?.sla}
          slaIndividualCorp={slaSegmentosData.individual?.corp?.sla}
          selectedSegmento={selectedSegmento}
          onSelectSegmento={setSelectedSegmento}
          canToggleMode={true}
          slaMode={slaMode}
          onToggleMode={setSlaMode}
          operacaoNome={operacaoNome}
          onOpenDetailsModal={onOpenDetailsModal}
        />

        {/* CARD 2: Campanha ativa */}
        <CampanhaAtivaCard
          campanhaInfo={campanhaInfo}
          campanhaPeriodoFormatado={campanhaPeriodoFormatado}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          historicoMeses={metricas?.historico}
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
          perdasQtd={selectedSegmento !== 'Total' ? perdasChartData.reduce((acc, c) => acc + (c.value || 0), 0) : displayMetricas.perdasQtd}
          pontosPerdidos={displayMetricas?.pontosPerdidos}
          chartData={perdasChartData}
          onOpenPerdasModal={onOpenPerdasModal}
        />

        {/* CARD 5: Reincidências */}
        <ReincidenciasCard
          percentualReincidencia={percentualReincidenciaFinal}
          reincidenciaQtd={
            selectedSegmento !== 'Total'
              ? reincidenciasChartData.reduce((acc, c) => acc + (c.value || 0), 0)
              : (reincidenciaMode === 'individual'
                ? displayMetricas.reincidenciaQtd
                : displayMetricas.reincidenciaEquipeQtd)
          }
          pontosReincidencia={displayMetricas?.pontosReincidencia}
          pontosReincidenciaEquipe={displayMetricas?.pontosReincidenciaEquipe}
          chartData={reincidenciasChartData}
          canToggleEquipe={canToggleTeamReincidencias}
          reincidenciaMode={reincidenciaMode}
          onToggleMode={setReincidenciaMode}
          onOpenReincidentesModal={onOpenReincidentesModal}
        />

        {/* CARD 6: Consumo de peças */}
        <ConsumoPecasCard
          totalPecasElegiveis={pecasDistribuicao.totalPecasElegiveis}
          percentualConsumo={pecasDistribuicao.percentualConsumo}
          pontosPecas={displayMetricas?.pontosPecas}
          pecasChart={pecasDistribuicao.categorias}
          onOpenPecasModal={onOpenPecasModal}
        />
      </div>
    </div>
  );
};
