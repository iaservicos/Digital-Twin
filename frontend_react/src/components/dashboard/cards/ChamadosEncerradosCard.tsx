import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BentoCard } from '../../ui/BentoCard';
import { Calendar, ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addDays, subDays } from 'date-fns';
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

  const DIAS_SEMANA_ABREV = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  // Sincroniza o mês de exibição caso selectedDate seja alterado externamente
  useEffect(() => {
    if (selectedDate) {
      try {
        const d = new Date(`${selectedDate}T12:00:00`);
        if (!isNaN(d.getTime())) {
          setCurrentCalendarMonth((prev) => {
            if (prev.getMonth() !== d.getMonth() || prev.getFullYear() !== d.getFullYear()) {
              return d;
            }
            return prev;
          });
        }
      } catch {
        // ignora data inválida
      }
    }
  }, [selectedDate]);

  // Estrutura de todos os dias do mês ativo para o Pickup Roller horizontal
  const dayPills = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const activeDateStr = selectedDate || todayStr;

    const start = startOfMonth(currentCalendarMonth);
    const end = endOfMonth(currentCalendarMonth);
    const days = eachDayOfInterval({ start, end });

    return days.map((d) => {
      const dStr = format(d, 'yyyy-MM-dd');
      const diaSemana = DIAS_SEMANA_ABREV[getDay(d)] || 'DIA';
      const diaNum = format(d, 'd');
      const count = chamadosData.atendimentosPorDia[dStr] || 0;
      const isToday = dStr === todayStr;
      const isSelected = dStr === activeDateStr;
      return { dStr, diaSemana, diaNum, count, isSelected, isToday };
    });
  }, [selectedDate, currentCalendarMonth, chamadosData.atendimentosPorDia]);

  // Refs para controle de rolagem e centralização do Pickup Roller
  const rollerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const hasDragged = useRef(false);

  // Auto-centraliza a pílula do dia selecionado
  const scrollToSelectedDate = (smooth = true) => {
    const activeStr = selectedDate || format(new Date(), 'yyyy-MM-dd');
    const el = pillRefs.current.get(activeStr);
    const container = rollerRef.current;
    if (el && container) {
      const containerWidth = container.clientWidth;
      const elLeft = el.offsetLeft;
      const elWidth = el.clientWidth;
      const targetScrollLeft = elLeft - containerWidth / 2 + elWidth / 2;
      container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  // Centraliza na montagem inicial e ao trocar de mês
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToSelectedDate(false);
    }, 60);
    return () => clearTimeout(timer);
  }, [currentCalendarMonth]);

  // Centraliza suavemente ao selecionar uma nova data
  useEffect(() => {
    scrollToSelectedDate(true);
  }, [selectedDate]);

  // Handlers para rolagem por arraste (mouse drag)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isMouseDown.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - (rollerRef.current?.offsetLeft || 0);
    scrollLeftStart.current = rollerRef.current?.scrollLeft || 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown.current || !rollerRef.current) return;
    const x = e.pageX - (rollerRef.current.offsetLeft || 0);
    const walk = x - startX.current;
    if (Math.abs(walk) > 4) {
      hasDragged.current = true;
    }
    rollerRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const handleMouseUp = () => {
    isMouseDown.current = false;
  };

  const handleMouseLeave = () => {
    isMouseDown.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (rollerRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      rollerRef.current.scrollLeft += e.deltaY;
    }
  };

  // Navegação rápida de 1 dia para frente ou para trás
  const handleStepDay = (step: -1 | 1) => {
    const activeStr = selectedDate || format(new Date(), 'yyyy-MM-dd');
    try {
      const current = new Date(`${activeStr}T12:00:00`);
      const nextDate = step === 1 ? addDays(current, 1) : subDays(current, 1);
      const nextDateStr = format(nextDate, 'yyyy-MM-dd');
      onSelectDate(nextDateStr);
    } catch {
      // fallback
    }
  };

  // Estrutura do calendário mensal completo (Modo Mês)
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentCalendarMonth);
    const end = endOfMonth(currentCalendarMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    return { days, leadingEmpty: startDay };
  }, [currentCalendarMonth]);

  const chamadosNoDia = useMemo(() => {
    const activeDate = selectedDate || format(new Date(), 'yyyy-MM-dd');
    return chamadosData.atendimentosPorDia[activeDate] || 0;
  }, [chamadosData.atendimentosPorDia, selectedDate]);

  const dataExtenso = useMemo(() => {
    const activeDate = selectedDate || format(new Date(), 'yyyy-MM-dd');
    try {
      const d = new Date(`${activeDate}T12:00:00`);
      return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
    } catch {
      return activeDate;
    }
  }, [selectedDate]);

  return (
    <BentoCard
      hoverable
      className={`min-h-[19.5rem] sm:min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between ${className}`}
    >
      {/* Cabeçalho do Card 3: Pílula 'Chamados encerrados' + Ações */}
      <div className="flex items-center justify-between relative z-10 gap-[0.5rem]">
        <div className="inline-flex items-center px-[0.625rem] py-[0.1875rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.6875rem] sm:text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
          Chamados encerrados
        </div>
        <div className="flex items-center gap-[0.375rem]">
          <span className="text-[0.625rem] sm:text-[0.6875rem] font-bold px-[0.5rem] py-[0.125rem] rounded-full bg-light-surface-elevated dark:bg-surface text-light-text-secondary dark:text-text-muted border border-light-border dark:border-border capitalize">
            {mesAnoLabel}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistoricoModal(selectedDate);
            }}
            className="w-[1.75rem] h-[1.75rem] sm:w-[2rem] sm:h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
            title="Ver lista de chamados"
          >
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      {/* Miolo do Card: Alterna entre Pílulas Horizontais e Calendário Mensal */}
      <div className="my-auto py-[0.5rem] relative z-10 w-full">
        {!showMonthCalendar ? (
          /* Modo 1: Pickup Roller Horizontal de Dias com Auto-Centralização */
          <div className="space-y-[0.625rem]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[0.375rem]">
                <span className="text-[0.6875rem] font-semibold text-light-text-muted dark:text-text-muted">
                  Atendimentos por dia
                </span>
                <div className="flex items-center gap-[0.125rem]">
                  <button
                    type="button"
                    onClick={() => handleStepDay(-1)}
                    className="w-[1.25rem] h-[1.25rem] rounded-full flex items-center justify-center text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main hover:bg-light-surface-elevated dark:hover:bg-surface-elevated transition-colors cursor-pointer"
                    title="Dia anterior"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepDay(1)}
                    className="w-[1.25rem] h-[1.25rem] rounded-full flex items-center justify-center text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main hover:bg-light-surface-elevated dark:hover:bg-surface-elevated transition-colors cursor-pointer"
                    title="Próximo dia"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
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

            <div className="relative w-full">
              {/* Contêiner de rolagem horizontal (Pickup Roller) */}
              <div
                ref={rollerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
                className="flex items-center gap-[0.375rem] sm:gap-[0.5rem] overflow-x-auto scrollbar-hide py-[0.375rem] px-[calc(50%-1.875rem)] scroll-smooth select-none cursor-grab active:cursor-grabbing snap-x snap-mandatory"
              >
                {dayPills.map((pill) => (
                  <button
                    key={pill.dStr}
                    ref={(el) => {
                      if (el) pillRefs.current.set(pill.dStr, el);
                      else pillRefs.current.delete(pill.dStr);
                    }}
                    type="button"
                    onClick={() => {
                      if (hasDragged.current) return;
                      onSelectDate(pill.dStr);
                    }}
                    className={`shrink-0 w-[3.5rem] sm:w-[3.75rem] snap-center flex flex-col items-center justify-center py-[0.4375rem] px-[0.25rem] sm:px-[0.375rem] rounded-[0.75rem] sm:rounded-[0.875rem] border transition-all cursor-pointer select-none group/btn ${
                      pill.isSelected
                        ? 'bg-primary text-slate-950 font-black shadow-lg shadow-primary/25 scale-[1.04] border-primary'
                        : pill.isToday
                          ? 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 hover:border-primary'
                          : 'bg-light-buttonBg dark:bg-buttonBg border-light-border dark:border-border text-light-text-muted dark:text-text-muted hover:border-light-borderHover dark:hover:border-borderHover hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover'
                    }`}
                    title={pill.isToday ? 'Hoje' : undefined}
                  >
                    <span
                      className={`text-[0.5625rem] sm:text-[0.625rem] uppercase font-bold tracking-tight opacity-85 transition-colors ${
                        pill.isSelected
                          ? 'text-slate-950'
                          : pill.isToday
                            ? 'text-primary font-black'
                            : 'text-light-text-muted dark:text-text-muted group-hover/btn:text-light-textHover dark:group-hover/btn:text-textHover'
                      }`}
                    >
                      {pill.diaSemana}
                    </span>
                    <span
                      className={`text-[0.9375rem] sm:text-[1.0625rem] font-black leading-tight mt-[0.125rem] transition-colors ${
                        pill.isSelected
                          ? 'text-slate-950'
                          : pill.isToday
                            ? 'text-primary'
                            : 'text-light-text-main dark:text-text-main group-hover/btn:text-light-textHover dark:group-hover/btn:text-textHover'
                      }`}
                    >
                      {pill.diaNum}
                    </span>
                    {pill.count > 0 ? (
                      <span
                        className={`w-[0.3125rem] h-[0.3125rem] rounded-full mt-[0.1875rem] ${
                          pill.isSelected ? 'bg-slate-950' : 'bg-primary'
                        }`}
                      />
                    ) : (
                      <span className="w-[0.3125rem] h-[0.3125rem] mt-[0.1875rem]" />
                    )}
                  </button>
                ))}
              </div>

              {/* Gradientes sutis nas bordas esquerda e direita para indicar continuidade de rolagem */}
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-[1.25rem] bg-gradient-to-r from-light-surface/90 dark:from-surface/90 to-transparent rounded-l-[0.875rem]" />
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-[1.25rem] bg-gradient-to-l from-light-surface/90 dark:from-surface/90 to-transparent rounded-r-[0.875rem]" />
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
        className="pt-[0.5rem] sm:pt-[0.75rem] border-t border-light-border dark:border-border/60 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity relative z-10 gap-[0.5rem]"
        title="Clique para abrir a lista detalhada de chamados desta data"
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-[0.25rem] sm:gap-[0.375rem] flex-wrap">
            <span className="text-[1.5rem] sm:text-[1.875rem] 2xl:text-[2.25rem] font-black text-light-text-main dark:text-text-main tracking-tight leading-none">
              {chamadosNoDia}
            </span>
            <span className="text-[0.6875rem] sm:text-[0.75rem] font-bold text-light-text-muted dark:text-text-muted truncate">
              {chamadosNoDia === 1 ? 'chamado atendido' : 'chamados atendidos'}
            </span>
          </div>
          <p className="text-[0.625rem] sm:text-[0.6875rem] text-light-text-muted dark:text-text-muted font-medium mt-[0.125rem] truncate">
            {dataExtenso}
          </p>
        </div>

        <div className="flex items-center gap-[0.25rem] text-[0.6875rem] sm:text-[0.75rem] font-bold text-primary group-hover:translate-x-0.5 transition-transform shrink-0">
          <span>Ver lista</span>
          <ArrowUpRight size={14} />
        </div>
      </div>
    </BentoCard>
  );
};
