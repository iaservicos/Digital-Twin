import React, { useState, useMemo } from 'react';
import { BentoCard } from '../../ui/BentoCard';
import { Calendar, ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ChamadosEncerradosCardProps {
  mesAnoLabel: string;
  chamadosData: {
    ultimoAtendimento: string | null;
    atendimentosPorDia: Record<string, number>;
    totalChamados: number;
  };
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenHistoricoModal: (date?: string) => void;
  className?: string;
}

export const ChamadosEncerradosCard: React.FC<ChamadosEncerradosCardProps> = ({
  mesAnoLabel,
  chamadosData,
  selectedDate,
  onSelectDate,
  onOpenHistoricoModal,
  className = ''
}) => {
  const [showMonthCalendar, setShowMonthCalendar] = useState(false);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(new Date());

  // Últimos 7 dias móveis baseados na data selecionada ou hoje
  const dayPills = useMemo(() => {
    const baseDate = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();
    const pills = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const dStr = format(d, 'yyyy-MM-dd');
      const diaSemana = format(d, 'eee', { locale: ptBR }).replace('.', '').toUpperCase();
      const diaNum = format(d, 'd');
      const count = chamadosData.atendimentosPorDia[dStr] || 0;
      const isSelected = dStr === selectedDate;
      pills.push({ dStr, diaSemana, diaNum, count, isSelected });
    }
    return pills;
  }, [selectedDate, chamadosData.atendimentosPorDia]);

  // Estrutura do calendário mensal
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentCalendarMonth);
    const end = endOfMonth(currentCalendarMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    return { days, leadingEmpty: startDay };
  }, [currentCalendarMonth]);

  const chamadosNoDia = useMemo(() => {
    return chamadosData.atendimentosPorDia[selectedDate] || 0;
  }, [chamadosData.atendimentosPorDia, selectedDate]);

  const dataExtenso = useMemo(() => {
    if (!selectedDate) return 'Selecione um dia';
    try {
      const d = new Date(`${selectedDate}T12:00:00`);
      return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <BentoCard
      hoverable
      className={`min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between ${className}`}
    >
      {/* Cabeçalho do Card 3: Pílula 'Chamados encerrados' + Ações */}
      <div className="flex items-center justify-between relative z-10">
        <div className="inline-flex items-center px-[0.75rem] py-[0.25rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
          Chamados encerrados
        </div>
        <div className="flex items-center gap-[0.375rem]">
          <span className="text-[0.6875rem] font-bold px-[0.625rem] py-[0.125rem] rounded-full bg-light-surface-elevated dark:bg-surface text-light-text-secondary dark:text-text-muted border border-light-border dark:border-border capitalize">
            {mesAnoLabel}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistoricoModal(selectedDate);
            }}
            className="w-[2rem] h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
            title="Ver lista de chamados"
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {/* Miolo do Card: Alterna entre Pílulas Horizontais e Calendário Mensal */}
      <div className="my-auto py-[0.5rem] relative z-10 w-full">
        {!showMonthCalendar ? (
          /* Modo 1: Pílulas Horizontais dos Dias com data do último atendimento */
          <div className="space-y-[0.75rem]">
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] font-semibold text-light-text-muted dark:text-text-muted">
                Atendimentos por dia
              </span>
              <button
                type="button"
                onClick={() => setShowMonthCalendar(true)}
                className="inline-flex items-center gap-[0.25rem] text-[0.6875rem] font-bold text-primary hover:underline cursor-pointer"
                title="Abrir calendário completo do mês"
              >
                <Calendar size={13} />
                <span>Mês</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-[0.375rem] overflow-x-auto scrollbar-hide py-[0.25rem]">
              {dayPills.map((pill) => (
                <button
                  key={pill.dStr}
                  type="button"
                  onClick={() => onSelectDate(pill.dStr)}
                  className={`flex-1 flex flex-col items-center justify-center py-[0.5rem] px-[0.375rem] rounded-[1rem] border transition-all cursor-pointer select-none group/btn ${
                    pill.isSelected
                      ? 'bg-primary text-slate-950 font-black shadow-lg shadow-primary/25 scale-[1.03] border-primary'
                      : 'bg-light-buttonBg dark:bg-buttonBg border-light-border dark:border-border text-light-text-muted dark:text-text-muted hover:border-light-borderHover dark:hover:border-borderHover hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover'
                  }`}
                >
                  <span
                    className={`text-[0.625rem] uppercase font-bold tracking-wider opacity-85 transition-colors ${
                      pill.isSelected
                        ? 'text-slate-950'
                        : 'text-light-text-muted dark:text-text-muted group-hover/btn:text-light-textHover dark:group-hover/btn:text-textHover'
                    }`}
                  >
                    {pill.diaSemana}
                  </span>
                  <span
                    className={`text-[1rem] font-black leading-tight mt-[0.125rem] transition-colors ${
                      pill.isSelected
                        ? 'text-slate-950'
                        : 'text-light-text-main dark:text-text-main group-hover/btn:text-light-textHover dark:group-hover/btn:text-textHover'
                    }`}
                  >
                    {pill.diaNum}
                  </span>
                  {pill.count > 0 ? (
                    <span
                      className={`w-[0.375rem] h-[0.375rem] rounded-full mt-[0.25rem] ${
                        pill.isSelected ? 'bg-slate-950' : 'bg-primary'
                      }`}
                    />
                  ) : (
                    <span className="w-[0.375rem] h-[0.375rem] mt-[0.25rem]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Modo 2: Calendário do Mês no Próprio Card */
          <div className="bg-light-surface-elevated dark:bg-surface/90 border border-light-border dark:border-border rounded-[1rem] p-[0.75rem] shadow-md">
            <div className="flex items-center justify-between mb-[0.5rem]">
              <div className="flex items-center gap-[0.25rem]">
                <button
                  type="button"
                  onClick={() => setCurrentCalendarMonth(subMonths(currentCalendarMonth, 1))}
                  className="p-[0.25rem] rounded-[0.5rem] text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[0.75rem] font-bold text-light-text-main dark:text-text-main capitalize">
                  {format(currentCalendarMonth, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentCalendarMonth(addMonths(currentCalendarMonth, 1))}
                  className="p-[0.25rem] rounded-[0.5rem] text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowMonthCalendar(false)}
                className="text-[0.625rem] font-bold text-primary hover:underline cursor-pointer"
              >
                Voltar
              </button>
            </div>

            {/* Dias da semana */}
            <div className="grid grid-cols-7 gap-[0.25rem] text-center text-[0.5625rem] font-bold text-light-text-muted dark:text-text-muted mb-[0.25rem] uppercase">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, idx) => (
                <span key={idx}>{dia}</span>
              ))}
            </div>

            {/* Grid dos dias */}
            <div className="grid grid-cols-7 gap-[0.25rem]">
              {Array.from({ length: monthDays.leadingEmpty }).map((_, idx) => (
                <span key={`empty-${idx}`} className="h-[1.5rem]" />
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
                      onSelectDate(dStr);
                      setShowMonthCalendar(false);
                    }}
                    className={`h-[1.5rem] w-full flex items-center justify-center rounded-[0.5rem] text-[0.625rem] font-bold transition-all cursor-pointer ${
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

      {/* Rodapé: Quantidade de chamados atendidos no dia selecionado */}
      <div
        onClick={() => onOpenHistoricoModal(selectedDate)}
        className="pt-[0.75rem] border-t border-light-border dark:border-border/60 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity relative z-10"
        title="Clique para abrir a lista detalhada de chamados desta data"
      >
        <div>
          <div className="flex items-baseline gap-[0.375rem]">
            <span className="text-[1.875rem] 2xl:text-[2.25rem] font-black text-light-text-main dark:text-text-main tracking-tight leading-none">
              {chamadosNoDia}
            </span>
            <span className="text-[0.75rem] font-bold text-light-text-muted dark:text-text-muted ml-[0.25rem]">
              {chamadosNoDia === 1 ? 'chamado atendido' : 'chamados atendidos'}
            </span>
          </div>
          <p className="text-[0.6875rem] text-light-text-muted dark:text-text-muted font-medium mt-[0.125rem]">
            {dataExtenso}
          </p>
        </div>

        <div className="flex items-center gap-[0.25rem] text-[0.75rem] font-bold text-primary group-hover:translate-x-0.5 transition-transform">
          <span>Ver lista</span>
          <ArrowUpRight size={14} />
        </div>
      </div>
    </BentoCard>
  );
};
