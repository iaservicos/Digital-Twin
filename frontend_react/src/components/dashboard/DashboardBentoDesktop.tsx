import React, { useState, useMemo, useEffect } from 'react';
import CartesianWaveChart from './CartesianWaveChart';
import { toTitleCase, formatLocalEquipe } from '../../utils/stringFormatters';
import { api } from '../../services/api';
import { 
  Search, 
  Bell, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  FileText, 
  Activity,
  ShieldAlert,
  Wrench,
  Layers,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  format, 
  parseISO, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardBentoDesktopProps {
  metricas: any;
  displayMetricas: any;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
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
  onOpenDetailsModal,
  onOpenSlaModal,
  onOpenReincidentesModal,
  onOpenPecasModal,
  onOpenPerdasModal,
  onOpenHistoricoModal,
  onOpenElegivelModal,
  onOpenInelegivelModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const percentualConsumo = displayMetricas.percentualEficienciaPecas || 0;
  const percentualSla = displayMetricas.percentualSla || 0;
  const percentualReincidencia = displayMetricas.percentualReincidencia || 0;
  const percentualPerdidos = displayMetricas.percentualPerdidos || 0;
  const pontuacaoTotal = displayMetricas.pontosTotal || 0;

  const selLower = (selectedMonth || '').trim().toLowerCase();
  const isCampanhaInteira = !selLower || selLower === 'campanha inteira' || selLower === 'média final' || selLower.includes('final') || selLower.includes('campanha');

  // Gauge circular radial com gap elegante nas pontas (layout12.excalidraw)
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  const gap = 12; // Respiro visual entre as pontas arredondadas dos arcos
  const usableLength = circumference - gap * 2;
  const progressRatio = Math.min(Math.max(pontuacaoTotal / 100, 0), 1);
  const activeLength = progressRatio * usableLength;
  const trackLength = Math.max(0, usableLength - activeLength);

  const targetTecnicoId = displayMetricas?.idTecnico ?? (metricas as any)?.idTecnico ?? (displayMetricas as any)?.id;

  // Dados cartesianos REAIS para Perdas de SLA do Técnico (Semanas x Quantidade de perdas)
  const [perdasChartData, setPerdasChartData] = useState<{ label: string; value: number }[]>([
    { label: 'Sem 1', value: 0 },
    { label: 'Sem 2', value: 0 },
    { label: 'Sem 3', value: 0 },
    { label: 'Sem 4', value: 0 },
  ]);

  useEffect(() => {
    let isMounted = true;
    const fetchPerdasSemanais = async () => {
      if (targetTecnicoId === undefined || targetTecnicoId === null) return;
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }
        const res = await api.get(`/dashboard/tecnico/${targetTecnicoId}/perdas-semanais`, { params });
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          setPerdasChartData(res.data);
        }
      } catch (err) {
        // Silencioso em caso de indisponibilidade momentânea
      }
    };
    fetchPerdasSemanais();
    return () => { isMounted = false; };
  }, [targetTecnicoId, selectedMonth]);

  // Dados cartesianos REAIS para Reincidências do Técnico (Semanas x Quantidade de retornos)
  const [reincidenciasChartData, setReincidenciasChartData] = useState<{ label: string; value: number }[]>([
    { label: 'Sem 1', value: 0 },
    { label: 'Sem 2', value: 0 },
    { label: 'Sem 3', value: 0 },
    { label: 'Sem 4', value: 0 },
  ]);

  useEffect(() => {
    let isMounted = true;
    const fetchReincidentesSemanais = async () => {
      if (targetTecnicoId === undefined || targetTecnicoId === null) return;
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }
        const res = await api.get(`/dashboard/tecnico/${targetTecnicoId}/reincidentes-semanais`, { params });
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          setReincidenciasChartData(res.data);
        }
      } catch (err) {
        // Silencioso
      }
    };
    fetchReincidentesSemanais();
    return () => { isMounted = false; };
  }, [targetTecnicoId, selectedMonth]);

  // Distribuição REAL das 4 categorias de peças elegíveis (Tela LCD, SSD, HD, PLM)
  const [pecasDistribuicao, setPecasDistribuicao] = useState<{
    totalAtendimentos: number;
    totalPecasElegiveis: number;
    percentualConsumo: number;
    categorias: { key: string; label: string; qtd: number; pct: number }[];
  }>({
    totalAtendimentos: 0,
    totalPecasElegiveis: 0,
    percentualConsumo: 0,
    categorias: [
      { key: 'tela', label: 'Tela LCD', qtd: 0, pct: 0 },
      { key: 'ssd', label: 'SSD', qtd: 0, pct: 0 },
      { key: 'hd', label: 'HD', qtd: 0, pct: 0 },
      { key: 'plm', label: 'PLM', qtd: 0, pct: 0 }
    ]
  });

  useEffect(() => {
    let isMounted = true;
    const fetchPecasDistribution = async () => {
      if (targetTecnicoId === undefined || targetTecnicoId === null) return;
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }
        const res = await api.get(`/dashboard/tecnico/${targetTecnicoId}/pecas-distribuicao`, { params });
        if (isMounted && res.data && Array.isArray(res.data.categorias)) {
          setPecasDistribuicao(res.data);
        }
      } catch (err) {
        // Silencioso
      }
    };

    fetchPecasDistribution();
    return () => { isMounted = false; };
  }, [targetTecnicoId, selectedMonth]);

  // Estados e carregamento do Card 3: Chamados Encerrados e Calendário de Atendimentos (Sem mocks)
  const [chamadosData, setChamadosData] = useState<{
    ultimoAtendimento: string | null;
    atendimentosPorDia: Record<string, number>;
    totalChamados: number;
  }>({
    ultimoAtendimento: null,
    atendimentosPorDia: {},
    totalChamados: 0,
  });

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showMonthCalendar, setShowMonthCalendar] = useState<boolean>(false);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(new Date(2026, 7, 1)); // Agosto 2026

  useEffect(() => {
    let isMounted = true;
    const fetchChamadosInfo = async () => {
      if (targetTecnicoId === undefined || targetTecnicoId === null) return;
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }
        const res = await api.get(`/dashboard/tecnico/${targetTecnicoId}/chamados`, { params });
        if (isMounted && res.data) {
          const atdPorDia = res.data.atendimentosPorDia || {};
          const ultAtd = res.data.ultimoAtendimento || Object.keys(atdPorDia)[0] || '';
          setChamadosData({
            ultimoAtendimento: ultAtd,
            atendimentosPorDia: atdPorDia,
            totalChamados: res.data.totalChamados || res.data.totalElements || 0,
          });
          if (ultAtd) {
            setSelectedDate(ultAtd);
            try {
              setCurrentCalendarMonth(parseISO(ultAtd));
            } catch {}
          }
        }
      } catch (err) {
        // Fallback silencioso
      }
    };

    fetchChamadosInfo();
    return () => { isMounted = false; };
  }, [targetTecnicoId, selectedMonth]);

  // 5 pílulas de dias em torno da data selecionada
  const dayPills = useMemo(() => {
    try {
      const baseDate = selectedDate ? parseISO(selectedDate) : new Date(2026, 7, 31);
      const days = [-2, -1, 0, 1, 2].map(offset => addDays(baseDate, offset));
      return days.map(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        const diaSemana = format(d, 'EEE', { locale: ptBR }).replace('.', '');
        const diaNum = format(d, 'd');
        const count = chamadosData.atendimentosPorDia[dStr] || 0;
        return {
          dStr,
          diaSemana,
          diaNum,
          count,
          isSelected: dStr === selectedDate
        };
      });
    } catch {
      return [];
    }
  }, [selectedDate, chamadosData.atendimentosPorDia]);

  // Grid de dias para o calendário do mês aberto no card
  const monthDays = useMemo(() => {
    try {
      const start = startOfMonth(currentCalendarMonth);
      const end = endOfMonth(currentCalendarMonth);
      const days = eachDayOfInterval({ start, end });
      const leadingEmpty = start.getDay(); // 0 = Domingo
      return { days, leadingEmpty };
    } catch {
      return { days: [], leadingEmpty: 0 };
    }
  }, [currentCalendarMonth]);

  const chamadosNoDia = selectedDate ? (chamadosData.atendimentosPorDia[selectedDate] || 0) : 0;

  const dataExtenso = useMemo(() => {
    try {
      return selectedDate ? format(parseISO(selectedDate), "dd 'de' MMMM", { locale: ptBR }) : 'Selecione uma data';
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const mesAnoLabel = useMemo(() => {
    try {
      return selectedDate ? format(parseISO(selectedDate), "MMMM/yyyy", { locale: ptBR }) : '';
    } catch {
      return '';
    }
  }, [selectedDate]);

  // Proporções e quantidades REAIS para as 4 peças oficiais da campanha: Tela LCD, SSD, HD e PLM
  const pecasChart = pecasDistribuicao.categorias;
  const maxPecaQtd = useMemo(() => Math.max(...pecasChart.map(p => p.qtd), 0), [pecasChart]);
  const maxPecaPct = useMemo(() => Math.max(...pecasChart.map(p => p.pct), 0), [pecasChart]);

  return (
    <div className="w-full space-y-6">

      {/* ========================================================================= */}
      {/* 1. CABEÇALHO SUPERIOR (Desktop)                                           */}
      {/* ========================================================================= */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-light-text-main dark:text-text-main tracking-tight">
            Dashboard de Performance
          </h2>
          <p className="text-xs text-light-text-muted dark:text-text-muted font-medium">
            {toTitleCase(displayMetricas.tecnico) || 'Técnico'}{displayMetricas.localEquipe ? ` • ${formatLocalEquipe(displayMetricas.localEquipe)}` : ''}
          </p>
        </div>

        {/* Barra de Pesquisa Central */}
        <div className="flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar chamado, métrica, indicador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong dark:border-border rounded-full pl-10 pr-4 py-2 text-xs text-light-text-main dark:text-text-main placeholder:text-light-text-muted dark:placeholder:text-text-muted focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all shadow-inner"
          />
        </div>

        {/* Ações à Direita: Botão de Elegibilidade + Notificações */}
        <div className="flex items-center gap-3">
          {displayMetricas.elegivel ? (
            <button
              onClick={onOpenElegivelModal}
              className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 px-4 py-2 rounded-full font-bold text-xs transition-colors cursor-pointer shadow-sm shadow-emerald-500/10"
            >
              <CheckCircle2 size={15} />
              <span>Elegível para Premiação</span>
            </button>
          ) : (
            <button
              onClick={onOpenInelegivelModal}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-full font-bold text-xs transition-colors cursor-pointer shadow-sm shadow-red-500/10"
            >
              <XCircle size={15} />
              <span>Não Elegível</span>
            </button>
          )}

          <button 
            className="relative p-2.5 rounded-full bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong dark:border-border text-light-text-muted dark:text-text-muted hover:text-primary transition-colors cursor-pointer"
            title="Notificações"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_#22d3ee]"></span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. GRID BENTO 3 COLUNAS x 2 LINHAS                                        */}
      {/* Transparência dos cards estritamente em 35% no Dark Mode (bg-surface/35)   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* --------------------------------------------------------------------- */}
        {/* CARD 1 (Linha 1, Col 1): Pontuação Global                             */}
        {/* --------------------------------------------------------------------- */}
        <div 
          onClick={onOpenDetailsModal}
          className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all cursor-pointer group relative overflow-hidden"
          title="Clique para ver o detalhamento completo dos 6 KPIs"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-light-text-main dark:text-text-main">
              Pontuação Global
            </h3>
            <span className="text-xs text-primary font-semibold group-hover:underline flex items-center gap-0.5">
              Detalhes <ArrowUpRight size={14} />
            </span>
          </div>

          {/* Gauge Circular Central com Gap Elegante */}
          <div className="flex flex-col items-center justify-center my-auto py-2">
            <div className="relative w-36 h-36 2xl:w-44 2xl:h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Trilha Inativa (Restante com gap nas pontas) */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="text-slate-200 dark:text-surface-hover transition-all duration-1000 ease-out"
                  strokeWidth="10"
                  stroke="currentColor"
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={`${trackLength} ${circumference}`}
                  strokeDashoffset={-(activeLength + gap)}
                />
                {/* Arco Ativo de Pontuação (Progresso com gap e pontas arredondadas) */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="text-primary transition-all duration-1000 ease-out"
                  strokeWidth="10"
                  strokeDasharray={`${activeLength} ${circumference}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(34, 211, 238, 0.4))' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl 2xl:text-5xl font-black text-light-text-main dark:text-text-main tracking-tight">
                  {pontuacaoTotal}
                </span>
                <span className="text-[11px] font-bold text-light-text-muted dark:text-text-muted">
                  / 100 pts
                </span>
              </div>
            </div>
          </div>

          {/* Legenda Dupla no Rodapé */}
          <div className="space-y-1.5 pt-2 border-t border-light-border dark:border-border/60">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_#22d3ee]"></span>
                <span className="text-light-text-secondary dark:text-text-muted font-medium">SLA no Prazo</span>
              </div>
              <span className="font-bold text-light-text-main dark:text-text-main">{percentualSla.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                <span className="text-light-text-secondary dark:text-text-muted font-medium">Eficiência Peças</span>
              </div>
              <span className="font-bold text-light-text-main dark:text-text-main">{percentualConsumo.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 2 (Linha 1, Col 2): SLA de Atendimento                           */}
        {/* --------------------------------------------------------------------- */}
        <div 
          className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all relative"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-light-text-main dark:text-text-main">
              SLA de Atendimento
            </h3>
            <button
              onClick={onOpenSlaModal}
              className="w-8 h-8 rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
              title="Ver chamados com estouro de SLA"
            >
              <ArrowUpRight size={16} />
            </button>
          </div>

          {/* Mini-Tabs de Seleção de Mês */}
          <div className="grid grid-cols-3 gap-2 my-2">
            <button
              onClick={() => setSelectedMonth('Campanha Inteira')}
              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer border ${
                isCampanhaInteira
                  ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                  : 'bg-light-surface-elevated dark:bg-surface border-light-border dark:border-border text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main hover:bg-light-surface-hover dark:hover:bg-surface-hover'
              }`}
            >
              <p className="text-[10px] uppercase font-semibold">Total</p>
              <p className="text-xs font-black">Geral</p>
            </button>

            {metricas?.historico && metricas.historico.filter((h: any) => h.mes !== 'Média Final').slice(0, 2).map((h: any, idx: number) => {
              const labelMes = h.mes;
              const isSelected = !isCampanhaInteira && (
                selLower === labelMes.toLowerCase() || 
                selLower === (h.mesReferencia || '').toLowerCase()
              );
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedMonth(labelMes)}
                  className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                      : 'bg-light-surface-elevated dark:bg-surface border-light-border dark:border-border text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main hover:bg-light-surface-hover dark:hover:bg-surface-hover'
                  }`}
                >
                  <p className="text-[10px] uppercase font-semibold">Mês {idx + 1}</p>
                  <p className="text-xs font-black truncate">{labelMes}</p>
                </button>
              );
            })}
          </div>

          {/* Valor de SLA e Meta */}
          <div>
            <p className="text-4xl font-black text-light-text-main dark:text-text-main tracking-tight">
              {percentualSla.toFixed(1)}%
            </p>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={`font-semibold ${percentualSla >= 90.0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {percentualSla >= 90.0 ? `+${(percentualSla - 90).toFixed(1)}% acima da meta` : `${(percentualSla - 90).toFixed(1)}% abaixo da meta`}
              </span>
              <span className="text-light-text-muted dark:text-text-muted text-[10px]">Meta: ≥ 90%</span>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 3 (Linha 1, Col 3): Chamados Encerrados & Mini Calendário        */}
        {/* --------------------------------------------------------------------- */}
        <div 
          className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between relative overflow-hidden group shadow-sm hover:border-primary/40 transition-all"
        >
          {/* Textura sutil geométrica / cyber grid */}
          <div className="absolute inset-0 opacity-10 dark:opacity-15 pointer-events-none bg-[radial-gradient(#22d3ee_1px,transparent_1px)] [background-size:16px_16px]"></div>

          {/* Cabeçalho do Card 3: Título "Chamados Encerrados" + Ações */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 size={16} />
              </span>
              <h3 className="text-sm font-bold text-light-text-main dark:text-text-main">
                Chamados Encerrados
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-light-surface-elevated dark:bg-surface text-light-text-secondary dark:text-text-muted border border-light-border dark:border-border capitalize">
                {mesAnoLabel}
              </span>
              <button
                type="button"
                onClick={() => onOpenHistoricoModal(selectedDate)}
                className="p-1 text-primary hover:text-primary-dark transition-colors cursor-pointer"
                title="Ver lista de chamados"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>

          {/* Miolo do Card: Alterna entre Pílulas Horizontais e Calendário Mensal */}
          <div className="my-auto py-2 relative z-10 w-full">
            {!showMonthCalendar ? (
              /* Modo 1: Pílulas Horizontais dos Dias com data do último atendimento */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-light-text-muted dark:text-text-muted">
                    Atendimentos por dia
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMonthCalendar(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    title="Abrir calendário completo do mês"
                  >
                    <Calendar size={13} />
                    <span>Mês</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-hide py-1">
                  {dayPills.map((pill) => (
                    <button
                      key={pill.dStr}
                      type="button"
                      onClick={() => setSelectedDate(pill.dStr)}
                      className={`flex-1 flex flex-col items-center justify-center py-2 px-1.5 rounded-2xl transition-all cursor-pointer select-none ${
                        pill.isSelected
                          ? 'bg-primary text-slate-950 font-black shadow-lg shadow-primary/25 scale-[1.03]'
                          : 'bg-light-surface-elevated dark:bg-surface/80 border border-light-border dark:border-border text-light-text-secondary dark:text-text-muted hover:border-primary/50'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-85">
                        {pill.diaSemana}
                      </span>
                      <span className="text-base font-black leading-tight mt-0.5">
                        {pill.diaNum}
                      </span>
                      {pill.count > 0 ? (
                        <span className={`w-1.5 h-1.5 rounded-full mt-1 ${pill.isSelected ? 'bg-slate-950' : 'bg-primary'}`} />
                      ) : (
                        <span className="w-1.5 h-1.5 mt-1" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Modo 2: Calendário do Mês no Próprio Card */
              <div className="bg-light-surface-elevated dark:bg-surface/90 border border-light-border dark:border-border rounded-2xl p-3 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentCalendarMonth(subMonths(currentCalendarMonth, 1))}
                      className="p-1 rounded-lg text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-bold text-light-text-main dark:text-text-main capitalize">
                      {format(currentCalendarMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentCalendarMonth(addMonths(currentCalendarMonth, 1))}
                      className="p-1 rounded-lg text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMonthCalendar(false)}
                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>

                {/* Dias da semana */}
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-light-text-muted dark:text-text-muted mb-1 uppercase">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, idx) => (
                    <span key={idx}>{dia}</span>
                  ))}
                </div>

                {/* Grid dos dias */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: monthDays.leadingEmpty }).map((_, idx) => (
                    <span key={`empty-${idx}`} className="h-6" />
                  ))}
                  {monthDays.days.map((d) => {
                    const dStr = format(d, 'yyyy-MM-dd');
                    const isSel = dStr === selectedDate;
                    const hasCalls = (chamadosData.atendimentosPorDia[dStr] || 0) > 0;
                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => {
                          setSelectedDate(dStr);
                          setShowMonthCalendar(false);
                        }}
                        className={`h-6 w-full flex items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          isSel
                            ? 'bg-primary text-slate-950 font-black'
                            : hasCalls
                            ? 'bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25'
                            : 'text-light-text-secondary dark:text-text-muted hover:bg-light-surface-hover dark:hover:bg-surface-hover'
                        }`}
                      >
                        {format(d, 'd')}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rodapé: Quantidade de chamados atendidos no dia selecionado + Ação ao Clicar */}
          <div 
            onClick={() => onOpenHistoricoModal(selectedDate)}
            className="pt-3 border-t border-light-border dark:border-border/60 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity relative z-10"
            title="Clique para abrir a lista detalhada de chamados desta data"
          >
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl 2xl:text-4xl font-black text-light-text-main dark:text-text-main tracking-tight">
                  {chamadosNoDia}
                </span>
                <span className="text-xs font-bold text-light-text-muted dark:text-text-muted">
                  {chamadosNoDia === 1 ? 'chamado atendido' : 'chamados atendidos'}
                </span>
              </div>
              <p className="text-[11px] text-light-text-muted dark:text-text-muted font-medium mt-0.5">
                {dataExtenso}
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
              <span>Ver lista</span>
              <ArrowUpRight size={14} />
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 4 (Linha 2, Col 1): Perdas de SLA (Falhas de Gestão & Transf.)   */}
        {/* --------------------------------------------------------------------- */}
        <div 
          onClick={onOpenPerdasModal}
          className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all cursor-pointer group"
          title="Chamados com erro de gestão ou transferência que geraram perda de SLA (Meta: ≤ 1.0%)"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold text-light-text-main dark:text-text-main">
                Perdas de SLA
              </h3>
            </div>
            <span className="text-xs text-amber-400 font-semibold group-hover:underline flex items-center gap-0.5">
              Detalhes <ArrowUpRight size={13} />
            </span>
          </div>

          <div className="pt-2">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-light-text-main dark:text-text-main tracking-tight">
                {percentualPerdidos.toFixed(1)}%
              </p>
              {displayMetricas.perdasQtd !== undefined && (
                <span className="text-xs text-light-text-muted dark:text-text-muted font-semibold">
                  ({displayMetricas.perdasQtd} ocorrências)
                </span>
              )}
            </div>
            <p className="text-[11px] text-light-text-muted dark:text-text-muted font-medium">
              Falhas de Gestão & Transferência (Meta: ≤ 1.0%)
            </p>
          </div>

          {/* Gráfico Cartesiano com Curva Neon Ciano (Altura expandida em REM) */}
          <div className="w-full pt-2">
            <CartesianWaveChart 
              data={perdasChartData}
              color="#22d3ee"
              gradientId="technicianPerdasGrad"
              height="7.5rem"
            />
          </div>

          <div className="pt-2 border-t border-light-border dark:border-border/60 flex items-center justify-between text-xs">
            {percentualPerdidos === 0 ? (
              <span className="font-bold text-[11px] text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                <span>✨ Parabéns! Zero perdas registradas</span>
              </span>
            ) : (
              <span className={`font-semibold text-[11px] ${percentualPerdidos <= 1.0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}>
                {percentualPerdidos <= 1.0 ? 'Dentro da meta operacional' : 'Acima do limite tolerado'}
              </span>
            )}
            <span className="text-light-text-muted dark:text-text-muted text-[10px]">Meta: ≤ 1.0%</span>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 5 (Linha 2, Col 2): Reincidências (Taxa de Retorno em 30 Dias)   */}
        {/* --------------------------------------------------------------------- */}
        <div 
          onClick={onOpenReincidentesModal}
          className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all cursor-pointer group overflow-hidden"
          title="Clique para ver a análise detalhada de reincidências"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-light-text-main dark:text-text-main">
                Reincidências
              </h3>
            </div>
            <span className="text-xs text-primary font-semibold group-hover:underline flex items-center gap-0.5">
              Detalhes <ArrowUpRight size={13} />
            </span>
          </div>

          <div className="pt-2">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-light-text-main dark:text-text-main tracking-tight">
                {percentualReincidencia.toFixed(1)}%
              </p>
              {displayMetricas.reincidenciaQtd !== undefined && (
                <span className="text-xs text-light-text-muted dark:text-text-muted font-semibold">
                  ({displayMetricas.reincidenciaQtd} retornos)
                </span>
              )}
            </div>
            <p className="text-[11px] text-light-text-muted dark:text-text-muted font-medium">
              Taxa de Retorno em 30 Dias (Meta: &lt; 7.0%)
            </p>
          </div>

          {/* Gráfico Cartesiano com Curva Neon Ciano (Altura expandida em REM) */}
          <div className="w-full pt-2">
            <CartesianWaveChart 
              data={reincidenciasChartData}
              color="#22d3ee"
              gradientId="technicianReincidenciasGrad"
              height="7.5rem"
            />
          </div>

          <div className="pt-2 border-t border-light-border dark:border-border/60 flex items-center justify-between text-xs">
            <span className={`font-semibold text-[11px] ${percentualReincidencia <= 7.0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}>
              {percentualReincidencia <= 7.0 ? 'Dentro da meta operacional' : 'Acima do limite tolerado'}
            </span>
            <span className="text-light-text-muted dark:text-text-muted text-[10px]">Meta: &lt; 7.0%</span>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 6 (Linha 2, Col 3): Consumo de Peças (Tela LCD, SSD, HD, PLM)    */}
        {/* --------------------------------------------------------------------- */}
        <div 
          onClick={onOpenPecasModal}
          className="bg-white/65 dark:bg-surface/35 backdrop-blur-md border border-light-borderStrong/70 dark:border-border/80 rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all cursor-pointer group"
          title="Clique para ver o detalhamento de peças da campanha (Tela LCD, SSD, HD e PLM)"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-light-text-main dark:text-text-main">
                Consumo de Peças
              </h3>
            </div>
            <span className="text-[11px] text-primary font-bold group-hover:underline">
              {pecasDistribuicao.totalPecasElegiveis} {pecasDistribuicao.totalPecasElegiveis === 1 ? 'peça aplicada' : 'peças aplicadas'}
            </span>
          </div>

          {/* Histograma / Bar Chart Vertical com as 4 Peças Solicitadas: Tela LCD, SSD, HD e PLM */}
          <div className="flex items-end justify-between gap-3 h-36 2xl:h-40 pt-3 pb-1">
            {pecasChart.map((peca) => {
              const isHighlight = peca.qtd > 0 && peca.qtd === maxPecaQtd;
              const barHeightPct = peca.qtd === 0 
                ? 10 
                : Math.max(16, Math.min(75, Math.round((peca.qtd / (maxPecaQtd || 1)) * 62) + 12));

              return (
                <div 
                  key={peca.key}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end relative group/bar"
                  title={`${peca.label}: ${peca.qtd} ${peca.qtd === 1 ? 'peça aplicada' : 'peças aplicadas'} (${peca.pct}%)`}
                >
                  {/* Badge com a Quantidade de Peças Utilizadas sobre a Barra */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md transition-all whitespace-nowrap ${
                      peca.qtd > 0
                        ? isHighlight
                          ? 'text-primary bg-primary/20 border border-primary/40 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                          : 'text-light-text-main dark:text-text-main bg-light-surface-elevated dark:bg-surface border border-light-border dark:border-border'
                        : 'text-light-text-muted dark:text-slate-500'
                    }`}>
                      {peca.qtd} {peca.qtd === 1 ? 'peça' : 'peças'}
                    </span>
                    <span className="text-[9px] font-bold text-light-text-muted dark:text-text-muted">
                      {peca.pct}%
                    </span>
                  </div>

                  {/* Barra Vertical */}
                  <div 
                    style={{ height: `${barHeightPct}%` }}
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      peca.qtd > 0
                        ? isHighlight
                          ? 'bg-primary shadow-[0_0_12px_rgba(34,211,238,0.5)]'
                          : 'bg-light-surface-elevated dark:bg-surface border border-light-border dark:border-border/60 group-hover/bar:bg-primary/50'
                        : 'bg-light-surface-hover dark:bg-surface-hover/60 group-hover/bar:bg-primary/30'
                    }`}
                  />

                  {/* Rótulo da Peça */}
                  <span className="text-[9px] text-light-text-muted dark:text-text-muted font-bold uppercase truncate max-w-full group-hover/bar:text-primary transition-colors">
                    {peca.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-light-border dark:border-border/60 flex items-center justify-between text-[11px]">
            <span className="text-light-text-muted dark:text-text-muted">Taxa de Consumo: <b className="text-primary">{percentualConsumo.toFixed(1)}%</b></span>
            <span className="text-light-text-muted dark:text-text-muted text-[10px]">Meta: ≤ 25.0%</span>
          </div>
        </div>

      </div>
    </div>
  );
};
