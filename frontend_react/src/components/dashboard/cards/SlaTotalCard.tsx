import React, { useMemo } from 'react';
import { BentoCard } from '../../ui/BentoCard';
import { ArrowUpRight } from 'lucide-react';
import { SegmentoType } from '../../common/SegmentoFilterPill';

export interface SlaTotalCardProps {
  slaTotal: number;
  slaGov?: number;
  slaCorp?: number;
  selectedSegmento?: SegmentoType;
  onSelectSegmento?: (seg: SegmentoType) => void;
  onOpenDetailsModal: () => void;
  className?: string;
}

export const SlaTotalCard: React.FC<SlaTotalCardProps> = ({
  slaTotal,
  slaGov,
  slaCorp,
  selectedSegmento = 'Total',
  onOpenDetailsModal,
  className = ''
}) => {
  const slaExibicao = useMemo(() => {
    if (selectedSegmento === 'Gov') return slaGov ?? slaTotal;
    if (selectedSegmento === 'Corp') return slaCorp ?? slaTotal;
    return slaTotal;
  }, [selectedSegmento, slaTotal, slaGov, slaCorp]);

  // Gauge circular radial calibrado em proporção harmônica e respiro interno (em REM)
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // ~251.33
  const gap = 10; // Respiro visual entre as pontas arredondadas dos arcos
  const usableLength = circumference - gap * 2;
  const activeLength = Math.max(0, Math.min(usableLength, (Math.min(slaExibicao, 100) / 100) * usableLength));
  const trackLength = Math.max(0, usableLength - activeLength);

  return (
    <BentoCard
      hoverable
      onClick={onOpenDetailsModal}
      className={`min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-primary/50 hover:shadow-glow-primary-sm ${className}`}
      title="Clique para ver o detalhamento completo dos 6 KPIs"
    >
      {/* Cabeçalho Padronizado: Pílula 'SLA total' + Badge Segmento Global + Botão Ação */}
      <div className="flex items-center justify-between gap-[0.5rem]">
        <div className="flex items-center gap-[0.5rem]">
          <div className="inline-flex items-center px-[0.75rem] py-[0.25rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
            SLA total
          </div>
          {selectedSegmento !== 'Total' && (
            <span className="text-[0.625rem] font-black uppercase tracking-wider px-[0.5rem] py-[0.125rem] rounded-full bg-primary/15 text-primary border border-primary/30">
              {selectedSegmento}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetailsModal();
          }}
          className="w-[2rem] h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
          title="Ver detalhamento completo dos 6 KPIs"
        >
          <ArrowUpRight size={16} />
        </button>
      </div>

      {/* Gauge Circular Central Calibrado em REM com Porcentagem e Status */}
      <div className="flex flex-col items-center justify-center my-auto py-[0.5rem]">
        <div className="relative w-[11.5rem] h-[11.5rem] 2xl:w-[13rem] 2xl:h-[13rem] flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Trilha Inativa (Restante com gap nas pontas) */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-light-chart-track dark:text-chart-track transition-all duration-1000 ease-out"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={`${trackLength} ${circumference}`}
              strokeDashoffset={-(activeLength + gap)}
            />
            {/* Arco Ativo de SLA (Progresso com gap e pontas arredondadas) */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className={`transition-all duration-1000 ease-out ${
                slaExibicao >= 90.0
                  ? 'text-primary drop-shadow-glow-primary'
                  : 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
              }`}
              strokeWidth="8"
              strokeDasharray={`${activeLength} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-[1.875rem] 2xl:text-[2.25rem] font-black text-light-text-main dark:text-text-main tracking-tight leading-none">
              {slaExibicao.toFixed(1)}%
            </span>
            <span
              className={`text-[0.6875rem] 2xl:text-[0.75rem] font-bold uppercase tracking-wider mt-[0.375rem] leading-none ${
                slaExibicao >= 90.0
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-amber-500 dark:text-amber-400'
              }`}
            >
              {slaExibicao >= 90.0 ? 'Meta Atingida' : 'Abaixo da Meta'}
            </span>
          </div>
        </div>
      </div>

      {/* Rodapé: Exibição da Meta de SLA e Status */}
      <div className="space-y-[0.375rem] pt-[0.5rem] border-t border-light-border dark:border-border/60">
        <div className="flex items-center justify-between text-[0.75rem]">
          <div className="flex items-center gap-[0.5rem]">
            <span className="w-[0.5rem] h-[0.5rem] rounded-full bg-primary shadow-glow-primary-sm"></span>
            <span className="text-light-text-muted dark:text-text-muted font-medium">Meta Oficial</span>
          </div>
          <span className="font-bold text-light-text-main dark:text-text-main">≥ 90.0%</span>
        </div>
        <div className="flex items-center justify-between text-[0.75rem]">
          <div className="flex items-center gap-[0.5rem]">
            <span
              className={`w-[0.5rem] h-[0.5rem] rounded-full ${
                slaExibicao >= 90.0
                  ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                  : 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
              }`}
            ></span>
            <span className="text-light-text-muted dark:text-text-muted font-medium">
              Status ({selectedSegmento})
            </span>
          </div>
          <span
            className={`font-bold ${
              slaExibicao >= 90.0
                ? 'text-emerald-500 dark:text-emerald-400'
                : 'text-amber-500 dark:text-amber-400'
            }`}
          >
            {slaExibicao >= 90.0
              ? `+${(slaExibicao - 90).toFixed(1)}% acima`
              : `${(slaExibicao - 90).toFixed(1)}% abaixo`}
          </span>
        </div>
      </div>
    </BentoCard>
  );
};
