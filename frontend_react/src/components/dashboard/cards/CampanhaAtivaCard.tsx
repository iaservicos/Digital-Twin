import React from 'react';
import { BentoCard } from '../../ui/BentoCard';
import { Award, Users, Calendar, Clock, ArrowUpRight } from 'lucide-react';

export interface CampanhaAtivaCardProps {
  campanhaInfo: {
    nomeCampanha?: string;
    tema?: string;
    totalParticipantes?: number;
    participantesAtivos?: number;
    duracaoDias?: number;
    diasRestantes?: number;
    progressoTempo?: number;
  } | null;
  campanhaPeriodoFormatado?: string;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  historicoMeses?: { mes: string; mesReferencia?: string }[];
  percentualSla: number;
  onOpenSlaModal: () => void;
  className?: string;
}

export const CampanhaAtivaCard: React.FC<CampanhaAtivaCardProps> = ({
  campanhaInfo,
  campanhaPeriodoFormatado = '01/09 a 30/09',
  selectedMonth,
  onSelectMonth,
  historicoMeses = [],
  percentualSla,
  onOpenSlaModal,
  className = ''
}) => {
  const isCampanhaInteira = selectedMonth === 'Campanha Inteira' || selectedMonth === 'Média Final';
  const selLower = selectedMonth.toLowerCase();

  return (
    <BentoCard
      className={`min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between ${className}`}
    >
      {/* Cabeçalho do Card 2 com Pílula 'Campanha ativa', Seletor Alinhado e Botão de Ação */}
      <div className="flex items-center justify-between gap-[0.5rem]">
        <div className="inline-flex items-center px-[0.75rem] py-[0.25rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
          Campanha ativa
        </div>

        {/* Seletor alinhado no cabeçalho ao lado do título */}
        <div className="flex items-center gap-[0.375rem]">
          <div className="flex items-center p-[0.125rem] rounded-[0.75rem] bg-light-surface-elevated dark:bg-surface border border-light-border dark:border-white/10 text-[0.625rem] font-bold">
            <button
              type="button"
              onClick={() => onSelectMonth('Campanha Inteira')}
              className={`px-[0.625rem] py-[0.25rem] rounded-[0.5rem] transition-all cursor-pointer ${
                isCampanhaInteira
                  ? 'bg-primary text-slate-950 font-black shadow-xs'
                  : 'bg-transparent text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main'
              }`}
            >
              Total
            </button>

            {historicoMeses
              .filter((h) => h.mes !== 'Média Final')
              .slice(0, 2)
              .map((h, idx) => {
                const labelMes = h.mes;
                const isSelected =
                  !isCampanhaInteira &&
                  (selLower === labelMes.toLowerCase() ||
                    selLower === (h.mesReferencia || '').toLowerCase());
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectMonth(labelMes)}
                    className={`px-[0.625rem] py-[0.25rem] rounded-[0.5rem] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-slate-950 font-black shadow-xs'
                        : 'bg-transparent text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main'
                    }`}
                  >
                    {labelMes}
                  </button>
                );
              })}
          </div>

          <button
            type="button"
            onClick={onOpenSlaModal}
            className="w-[2rem] h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
            title="Ver detalhes de SLA e regulamento"
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {/* Corpo do Card 2 com as 4 Informações da Campanha */}
      <div className="grid grid-cols-2 gap-[0.625rem] my-auto py-[0.25rem]">
        {/* 1. Campanha Atual */}
        <div className="bg-light-surface-elevated/70 dark:bg-surface-elevated/50 border border-light-border dark:border-border/60 rounded-[0.75rem] p-[0.625rem] flex flex-col justify-between">
          <div className="flex items-center gap-[0.375rem] text-primary mb-[0.25rem]">
            <Award size={14} />
            <span className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Campanha Atual
            </span>
          </div>
          <p
            className="text-[0.75rem] font-black text-light-text-main dark:text-text-main truncate"
            title={campanhaInfo?.nomeCampanha || 'Campanha Setembro 2026'}
          >
            {campanhaInfo?.nomeCampanha || 'Campanha Setembro 2026'}
          </p>
          <span className="text-[0.5625rem] text-light-text-muted dark:text-text-muted font-medium truncate mt-[0.125rem]">
            {campanhaInfo?.tema || 'Conexão Total'}
          </span>
        </div>

        {/* 2. Participantes */}
        <div className="bg-light-surface-elevated/70 dark:bg-surface-elevated/50 border border-light-border dark:border-border/60 rounded-[0.75rem] p-[0.625rem] flex flex-col justify-between">
          <div className="flex items-center gap-[0.375rem] text-primary mb-[0.25rem]">
            <Users size={14} />
            <span className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Participantes
            </span>
          </div>
          <p className="text-[0.875rem] font-black text-light-text-main dark:text-text-main">
            {campanhaInfo?.totalParticipantes || 403}{' '}
            <span className="text-[0.6875rem] font-semibold text-light-text-muted dark:text-text-muted">
              técnicos
            </span>
          </p>
          <span className="text-[0.5625rem] text-emerald-500 font-bold truncate mt-[0.125rem]">
            {campanhaInfo?.participantesAtivos || 176} ativos em campo
          </span>
        </div>

        {/* 3. Duração da Campanha */}
        <div className="bg-light-surface-elevated/70 dark:bg-surface-elevated/50 border border-light-border dark:border-border/60 rounded-[0.75rem] p-[0.625rem] flex flex-col justify-between">
          <div className="flex items-center gap-[0.375rem] text-primary mb-[0.25rem]">
            <Calendar size={14} />
            <span className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Duração
            </span>
          </div>
          <p className="text-[0.875rem] font-black text-light-text-main dark:text-text-main">
            {campanhaInfo?.duracaoDias || 30}{' '}
            <span className="text-[0.6875rem] font-semibold text-light-text-muted dark:text-text-muted">
              dias
            </span>
          </p>
          <span className="text-[0.5625rem] text-light-text-muted dark:text-text-muted font-medium truncate mt-[0.125rem]">
            {campanhaPeriodoFormatado}
          </span>
        </div>

        {/* 4. Tempo Restante */}
        <div className="bg-light-surface-elevated/70 dark:bg-surface-elevated/50 border border-light-border dark:border-border/60 rounded-[0.75rem] p-[0.625rem] flex flex-col justify-between">
          <div className="flex items-center gap-[0.375rem] text-primary mb-[0.25rem]">
            <Clock size={14} />
            <span className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted uppercase tracking-wider">
              Tempo Restante
            </span>
          </div>
          <p className="text-[0.75rem] font-black text-light-text-main dark:text-text-main">
            {campanhaInfo?.diasRestantes && campanhaInfo.diasRestantes > 0
              ? `${campanhaInfo.diasRestantes} dias restantes`
              : 'Fase de Fechamento'}
          </p>
          <div className="w-full bg-light-chart-track dark:bg-chart-track rounded-full h-[0.25rem] mt-[0.375rem] overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(5, campanhaInfo?.progressoTempo ?? 100))}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Rodapé: Resumo de SLA e Meta */}
      <div className="pt-[0.5rem] border-t border-light-border dark:border-border/60 flex items-center justify-between text-[0.75rem]">
        <span className="text-[0.6875rem] text-light-text-secondary dark:text-text-muted">
          SLA Operacional:{' '}
          <b className="text-light-text-main dark:text-text-main">
            {percentualSla.toFixed(1)}%
          </b>
        </span>
        <span
          className={`text-[0.625rem] font-bold px-[0.5rem] py-[0.125rem] rounded-[0.375rem] ${
            percentualSla >= 90.0
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-red-500/10 text-red-500'
          }`}
        >
          {percentualSla >= 90.0 ? 'Meta Atingida' : 'Abaixo da Meta'}
        </span>
      </div>
    </BentoCard>
  );
};
