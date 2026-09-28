import React, { useMemo, useState, useEffect } from 'react';
import { api } from '../../services/api';
import { format, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CartesianWaveChart from './CartesianWaveChart';
import { 
  ArrowUpRight, 
  FileText, 
  Activity, 
  Layers, 
  ShieldAlert, 
  Wrench,
  Clock,
  Sparkles,
  TrendingUp,
  Cpu,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

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
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
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
  selectedEquipeNome,
  selectedMonth,
  setSelectedMonth,
  onOpenDetailsModal,
  onOpenSlaModal,
  onOpenHistoricoModal,
  onOpenPerdasModal,
  onOpenReincidentesModal,
  onOpenPecasModal
}) => {
  const pontosTotal = Math.round(teamSummary.pontosMedia);
  const percentualSla = teamSummary.slaMedia;
  const percentualConsumo = teamSummary.pecasMedia;
  const percentualReincidencia = teamSummary.reincidenciaMedia;
  const percentualPerdidos = teamSummary.perdasMedia;

  const selLower = (selectedMonth || '').trim().toLowerCase();
  const isCampanhaInteira = !selLower || selLower === 'campanha inteira' || selLower === 'média final' || selLower.includes('final') || selLower.includes('campanha');

  // Gauge circular radial com gap elegante
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  const gap = 12; // Gap de espaçamento elegante
  const usableLength = circumference - (gap * 2);
  const activeLength = Math.max(0, Math.min(usableLength, (Math.min(pontosTotal, 100) / 100) * usableLength));
  const trackLength = Math.max(0, usableLength - activeLength);

  // Estados e carregamento do Card 3: Chamados Encerrados e Calendário de Atendimentos
  // Estados e carregamento do Card 3: Chamados Encerrados e Calendário de Atendimentos
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
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }
        if (selectedEquipe && selectedEquipe !== 'all') {
          params.equipe = selectedEquipe;
        }
        const res = await api.get('/dashboard/tecnico/0/chamados', { params });
        if (isMounted && res.data) {
          const atdPorDia = res.data.atendimentosPorDia || {};
          const ultAtd = res.data.ultimoAtendimento || Object.keys(atdPorDia)[0] || '';
          setChamadosData({
            ultimoAtendimento: ultAtd,
            atendimentosPorDia: atdPorDia,
            totalChamados: res.data.totalChamados || res.data.totalElements || teamSummary.volumeChamados,
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
  }, [selectedEquipe, selectedMonth, teamSummary.volumeChamados]);

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

  // Dados cartesianos REAIS para Perdas de SLA da Operação/Equipe
  const [adminPerdasChartData, setAdminPerdasChartData] = useState<{ label: string; value: number }[]>([
    { label: 'Sem 1', value: 0 },
    { label: 'Sem 2', value: 0 },
    { label: 'Sem 3', value: 0 },
    { label: 'Sem 4', value: 0 },
  ]);

  useEffect(() => {
    let isMounted = true;
    const fetchAdminPerdas = async () => {
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }
        if (selectedEquipe && selectedEquipe !== 'all') {
          params.equipe = selectedEquipe;
        }
        const res = await api.get('/dashboard/tecnico/0/perdas-semanais', { params });
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          setAdminPerdasChartData(res.data);
        }
      } catch (err) {
        // Silencioso
      }
    };
    fetchAdminPerdas();
    return () => { isMounted = false; };
  }, [selectedEquipe, selectedMonth]);

  // Dados cartesianos REAIS para Reincidências da Operação/Equipe
  const [adminReincidenciasChartData, setAdminReincidenciasChartData] = useState<{ label: string; value: number }[]>([
    { label: 'Sem 1', value: 0 },
    { label: 'Sem 2', value: 0 },
    { label: 'Sem 3', value: 0 },
    { label: 'Sem 4', value: 0 },
  ]);

  useEffect(() => {
    let isMounted = true;
    const fetchAdminReincidencias = async () => {
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }
        if (selectedEquipe && selectedEquipe !== 'all') {
          params.equipe = selectedEquipe;
        }
        const res = await api.get('/dashboard/tecnico/0/reincidentes-semanais', { params });
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          setAdminReincidenciasChartData(res.data);
        }
      } catch (err) {
        // Silencioso
      }
    };
    fetchAdminReincidencias();
    return () => { isMounted = false; };
  }, [selectedEquipe, selectedMonth]);

  // Distribuição REAL das peças da Operação/Equipe
  const [adminPecasDistribuicao, setAdminPecasDistribuicao] = useState<{
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
    const fetchAdminPecas = async () => {
      try {
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }
        if (selectedEquipe && selectedEquipe !== 'all') {
          params.equipe = selectedEquipe;
        }
        const res = await api.get('/dashboard/tecnico/0/pecas-distribuicao', { params });
        if (isMounted && res.data && Array.isArray(res.data.categorias)) {
          setAdminPecasDistribuicao(res.data);
        }
      } catch (err) {
        // Silencioso
      }
    };
    fetchAdminPecas();
    return () => { isMounted = false; };
  }, [selectedEquipe, selectedMonth]);

  return (
    <div className="w-full space-y-4">
      {/* GRID BENTO 3 COLUNAS x 2 LINHAS (Padrão Oficial Positivo em REM) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* --------------------------------------------------------------------- */}
        {/* CARD 1 (Linha 1, Col 1): Pontuação Global da Operação                  */}
        {/* --------------------------------------------------------------------- */}
        <div 
          onClick={onOpenDetailsModal}
          className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10 transition-all cursor-pointer group relative overflow-hidden"
          title="Clique para ver o detalhamento completo dos 6 KPIs da operação"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                Média Operacional
              </span>
              <h3 className="text-sm font-bold text-light-text-main dark:text-slate-200 mt-1">
                Pontuação da Equipe
              </h3>
            </div>
            <span className="text-xs text-cyan-400 font-semibold group-hover:underline flex items-center gap-0.5">
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
                  className="text-slate-200 dark:text-slate-800 transition-all duration-1000 ease-out"
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
                  className="text-cyan-400 transition-all duration-1000 ease-out"
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
                <span className="text-4xl 2xl:text-5xl font-black text-light-text-main dark:text-slate-100 tracking-tight">
                  {pontosTotal}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  / 100 pts
                </span>
              </div>
            </div>
          </div>

          {/* Legenda Dupla no Rodapé */}
          <div className="space-y-1.5 pt-2 border-t border-light-borderStrong/60 dark:border-border/60">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#00FFFF]"></span>
                <span className="text-slate-400 font-medium">SLA Médio</span>
              </div>
              <span className="font-bold text-light-text-main dark:text-slate-200">{percentualSla.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"></span>
                <span className="text-slate-400 font-medium">Eficiência Peças</span>
              </div>
              <span className="font-bold text-light-text-main dark:text-slate-200">{percentualConsumo.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 2 (Linha 1, Col 2): SLA de Atendimento da Operação                 */}
        {/* --------------------------------------------------------------------- */}
        <div 
          className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10 transition-all relative"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-light-text-main dark:text-slate-200">
              SLA da Operação
            </h3>
            <button
              onClick={onOpenSlaModal}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 flex items-center justify-center transition-colors cursor-pointer"
              title="Ver chamados com estouro de SLA na base/operação"
            >
              <ArrowUpRight size={16} />
            </button>
          </div>

          {/* Mini-Tabs de Seleção de Período */}
          <div className="grid grid-cols-2 gap-2 my-2">
            <button
              onClick={() => setSelectedMonth('Campanha Inteira')}
              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer border ${
                isCampanhaInteira
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-sm'
                  : 'bg-light-background dark:bg-surface-elevated border-light-borderStrong/60 dark:border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <p className="text-[10px] uppercase font-semibold">Geral</p>
              <p className="text-xs font-black">Campanha</p>
            </button>
            <div className="py-2 px-1 rounded-xl text-center border bg-light-background dark:bg-surface-elevated border-light-borderStrong/60 dark:border-slate-800 text-slate-300">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Escopo</p>
              <p className="text-xs font-black truncate text-cyan-400">
                {selectedEquipe !== 'all' ? selectedEquipe : `${teamSummary.qtd} técnicos`}
              </p>
            </div>
          </div>

          {/* Valor de SLA e Meta */}
          <div>
            <p className="text-4xl font-black text-light-text-main dark:text-slate-100 tracking-tight">
              {percentualSla.toFixed(1)}%
            </p>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={`font-semibold ${percentualSla >= 90.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {percentualSla >= 90.0 ? `+${(percentualSla - 90).toFixed(1)}% acima da meta` : `${(percentualSla - 90).toFixed(1)}% abaixo da meta`}
              </span>
              <span className="text-slate-500 text-[10px]">Meta: ≥ 90%</span>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 3 (Linha 1, Col 3): Chamados Encerrados & Mini Calendário        */}
        {/* --------------------------------------------------------------------- */}
        <div 
          className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between relative overflow-hidden group shadow-sm hover:border-cyan-500/40 transition-all"
        >
          {/* Textura sutil geométrica */}
          <div className="absolute inset-0 opacity-10 dark:opacity-15 pointer-events-none bg-[radial-gradient(#0891b2_1px,transparent_1px)] [background-size:16px_16px]"></div>

          {/* Cabeçalho do Card 3: Título "Chamados Encerrados" + Ações */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400">
                <CheckCircle2 size={16} />
              </span>
              <h3 className="text-sm font-bold text-light-text-main dark:text-slate-200">
                Chamados Encerrados
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-light-background dark:bg-slate-800 text-slate-400 dark:text-slate-300 border border-light-borderStrong/60 dark:border-slate-700/60 capitalize">
                {mesAnoLabel}
              </span>
              <button
                type="button"
                onClick={() => onOpenHistoricoModal(selectedDate)}
                className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
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
                  <span className="text-[11px] font-semibold text-slate-400">
                    Atendimentos por dia
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMonthCalendar(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:underline cursor-pointer"
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
                          ? 'bg-cyan-400 text-slate-950 font-black shadow-lg shadow-cyan-400/25 scale-[1.03]'
                          : 'bg-light-background dark:bg-slate-800/80 border border-light-borderStrong/60 dark:border-slate-700/60 text-slate-400 dark:text-slate-300 hover:border-cyan-500/50'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-85">
                        {pill.diaSemana}
                      </span>
                      <span className="text-base font-black leading-tight mt-0.5">
                        {pill.diaNum}
                      </span>
                      {pill.count > 0 ? (
                        <span className={`w-1.5 h-1.5 rounded-full mt-1 ${pill.isSelected ? 'bg-slate-950' : 'bg-cyan-400'}`} />
                      ) : (
                        <span className="w-1.5 h-1.5 mt-1" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Modo 2: Calendário do Mês no Próprio Card */
              <div className="bg-light-background dark:bg-slate-800/90 border border-light-borderStrong/60 dark:border-slate-700/60 rounded-2xl p-3 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentCalendarMonth(subMonths(currentCalendarMonth, 1))}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-bold text-light-text-main dark:text-slate-200 capitalize">
                      {format(currentCalendarMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentCalendarMonth(addMonths(currentCalendarMonth, 1))}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMonthCalendar(false)}
                    className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>

                {/* Dias da semana */}
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-400 mb-1 uppercase">
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
                            ? 'bg-cyan-400 text-slate-950 font-black'
                            : hasCalls
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25'
                            : 'text-slate-400 hover:bg-slate-700/50'
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
            className="pt-3 border-t border-light-borderStrong/60 dark:border-border/60 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity relative z-10"
            title="Clique para abrir a lista detalhada de chamados desta data"
          >
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl 2xl:text-4xl font-black text-light-text-main dark:text-slate-100 tracking-tight">
                  {chamadosNoDia}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {chamadosNoDia === 1 ? 'chamado atendido' : 'chamados atendidos'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {dataExtenso}
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-cyan-400 group-hover:translate-x-0.5 transition-transform">
              <span>Ver lista</span>
              <ArrowUpRight size={14} />
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 4 (Linha 2, Col 1): Perdas de SLA da Operação                     */}
        {/* --------------------------------------------------------------------- */}
        <div 
          onClick={onOpenPerdasModal}
          className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all cursor-pointer group"
          title="Clique para ver falhas de gestão e transferência na equipe"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold text-light-text-main dark:text-slate-200">
                Perdas de SLA
              </h3>
            </div>
            <span className="text-xs text-amber-400 font-semibold group-hover:underline">
              Detalhes
            </span>
          </div>

          <div className="pt-2">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-light-text-main dark:text-slate-100 tracking-tight">
                {percentualPerdidos.toFixed(1)}%
              </p>
              <span className="text-xs text-slate-400 font-semibold">
                ({teamSummary.perdasQtd} ocorrências)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Falhas de Gestão & Transferência (Meta: ≤ 1.0%)
            </p>
          </div>

          {/* Gráfico Cartesiano com Curva Neon Ciano (Altura expandida em REM) */}
          <div className="w-full pt-2">
            <CartesianWaveChart 
              data={adminPerdasChartData}
              color="#00FFFF"
              gradientId="adminPerdasGrad"
              height="7.5rem"
            />
          </div>

          <div className="pt-2 border-t border-light-borderStrong/60 dark:border-border/60 flex items-center justify-between text-xs">
            {percentualPerdidos === 0 ? (
              <span className="font-bold text-[11px] text-emerald-400 flex items-center gap-1">
                <span>✨ Parabéns! Zero perdas na base</span>
              </span>
            ) : (
              <span className={`font-semibold text-[11px] ${percentualPerdidos <= 1.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {percentualPerdidos <= 1.0 ? 'Dentro da meta operacional' : 'Acima do limite tolerado'}
              </span>
            )}
            <span className="text-slate-500 text-[10px]">Meta: ≤ 1.0%</span>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 5 (Linha 2, Col 2): Reincidências da Operação (30D)                */}
        {/* --------------------------------------------------------------------- */}
        <div 
          onClick={onOpenReincidentesModal}
          className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10 transition-all cursor-pointer group overflow-hidden"
          title="Clique para ver a análise de falhas reincidentes da operação"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-light-text-main dark:text-slate-200">
                Reincidências (30D)
              </h3>
            </div>
            <span className="text-xs text-cyan-400 font-semibold group-hover:underline">
              Detalhes
            </span>
          </div>

          <div className="pt-2">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-light-text-main dark:text-slate-100 tracking-tight">
                {percentualReincidencia.toFixed(1)}%
              </p>
              <span className="text-xs text-slate-400 font-semibold">
                ({teamSummary.reincidenciaQtd} retornos)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Taxa de Retorno em 30 Dias (Meta: &lt; 7.0%)
            </p>
          </div>

          {/* Gráfico Cartesiano com Curva Neon Ciano (Altura expandida em REM) */}
          <div className="w-full pt-2">
            <CartesianWaveChart 
              data={adminReincidenciasChartData}
              color="#00FFFF"
              gradientId="adminReincidenciasGrad"
              height="7.5rem"
            />
          </div>

          <div className="pt-2 border-t border-light-borderStrong/60 dark:border-border/60 flex items-center justify-between text-xs">
            <span className={`font-semibold text-[11px] ${percentualReincidencia <= 7.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {percentualReincidencia <= 7.0 ? 'Dentro da meta operacional' : 'Acima do limite tolerado'}
            </span>
            <span className="text-slate-500 text-[10px]">Meta: &lt; 7.0%</span>
          </div>
        </div>

        {/* --------------------------------------------------------------------- */}
        {/* CARD 6 (Linha 2, Col 3): Eficiência no Uso de Peças                    */}
        {/* --------------------------------------------------------------------- */}
        <div 
          onClick={onOpenPecasModal}
          className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-[24px] p-6 min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/10 transition-all cursor-pointer group"
          title="Clique para ver o consumo de peças na operação"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-light-text-main dark:text-slate-200">
                Consumo de Peças
              </h3>
            </div>
            <span className="text-[11px] text-cyan-400 font-bold group-hover:underline">
              Histórico
            </span>
          </div>

          <div className="my-1">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-semibold text-slate-400">Eficiência Média</span>
              <span className="text-xs font-bold text-emerald-400">
                {percentualConsumo >= 85 ? 'Meta Atingida' : 'Abaixo da Meta'}
              </span>
            </div>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">
              {percentualConsumo.toFixed(1)}%
            </p>
          </div>

          {/* Histograma Real das Categorias de Peças da Operação (Tela LCD, SSD, HD, PLM) */}
          <div className="space-y-2.5 pt-3 border-t border-light-borderStrong/60 dark:border-border/60">
            {adminPecasDistribuicao.categorias.map((cat, idx) => {
              const colors = ['bg-cyan-400', 'bg-sky-400', 'bg-indigo-400', 'bg-emerald-400'];
              const barColor = colors[idx % colors.length];
              return (
                <div key={cat.key}>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>{cat.label} {cat.qtd > 0 ? `(${cat.qtd.toLocaleString('pt-BR')} un)` : ''}</span>
                    <span className="font-semibold text-light-text-main dark:text-slate-200">{cat.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${barColor} rounded-full transition-all duration-500`} 
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
