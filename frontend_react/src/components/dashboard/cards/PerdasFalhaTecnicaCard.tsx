import React, { useMemo } from 'react';
import { BentoCard } from '../../ui/BentoCard';
import CartesianWaveChart from '../CartesianWaveChart';
import { ArrowUpRight } from 'lucide-react';

export interface PerdasFalhaTecnicaCardProps {
  percentualPerdidos: number;
  perdasQtd?: number;
  pontosPerdidos?: number;
  chartData: { label: string; value: number }[];
  onOpenPerdasModal: () => void;
  className?: string;
}

export const PerdasFalhaTecnicaCard: React.FC<PerdasFalhaTecnicaCardProps> = ({
  percentualPerdidos,
  perdasQtd,
  pontosPerdidos,
  chartData,
  onOpenPerdasModal,
  className = ''
}) => {
  // Pontuação oficial conforme a regra:
  // Meta: <= 1.0% -> 21.0 pts | 1.1% a 2.0% -> 16.0 pts | > 2.0% -> 0.0 pts
  const pontosCalculados = useMemo(() => {
    if (pontosPerdidos !== undefined && pontosPerdidos !== null) {
      return Number(pontosPerdidos);
    }
    if (percentualPerdidos <= 1.0) return 21.0;
    if (percentualPerdidos <= 2.0) return 16.0;
    return 0.0;
  }, [pontosPerdidos, percentualPerdidos]);

  return (
    <BentoCard
      hoverable
      onClick={onOpenPerdasModal}
      className={`min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-amber-500/50 hover:shadow-amber-500/10 ${className}`}
      title="Chamados com erro de gestão ou transferência que geraram perda de SLA (Máx: 21,0 pts)"
    >
      <div className="flex items-center justify-between gap-[0.5rem]">
        <div className="flex items-center gap-[0.5rem]">
          <div className="inline-flex items-center px-[0.75rem] py-[0.25rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
            Perdas - Falha técnica
          </div>
          {/* Badge de Pontuação Oficial */}
          <div className="inline-flex items-center gap-[0.25rem] px-[0.625rem] py-[0.25rem] rounded-full bg-primary/10 border border-primary/25 text-primary text-[0.75rem] font-black shadow-xs">
            <span>{pontosCalculados.toFixed(1)}</span>
            <span className="text-[0.625rem] text-light-text-muted dark:text-text-muted font-normal">/ 21,0 pts</span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPerdasModal();
          }}
          className="w-[2rem] h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-amber-500/20 text-light-text-muted dark:text-text-muted hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
          title="Ver chamados com perda de SLA"
        >
          <ArrowUpRight size={16} />
        </button>
      </div>

      <div className="pt-[0.5rem]">
        <div className="flex items-baseline gap-[0.5rem]">
          <p className="text-[1.875rem] 2xl:text-[2.25rem] font-black text-light-text-main dark:text-text-main tracking-tight leading-none">
            {percentualPerdidos.toFixed(1)}%
          </p>
          {perdasQtd !== undefined && (
            <span className="text-[0.75rem] text-light-text-muted dark:text-text-muted font-semibold">
              ({perdasQtd} ocorrências)
            </span>
          )}
        </div>
        <p className="text-[0.6875rem] text-light-text-muted dark:text-text-muted font-medium mt-[0.25rem]">
          Falhas de Gestão & Transf. (Meta: ≤ 1.0% | Tolerado: ≤ 2.0%)
        </p>
      </div>

      {/* Gráfico Cartesiano com Curva Neon (Altura calibrada em REM) */}
      <div className="w-full pt-[0.5rem]">
        <CartesianWaveChart
          data={chartData}
          gradientId="perdasWaveGrad"
          height="7.5rem"
        />
      </div>

      <div className="pt-[0.5rem] border-t border-light-border dark:border-border/60 flex items-center justify-between text-[0.75rem]">
        <div className="flex items-center gap-[0.375rem]">
          <span
            className={`w-[0.5rem] h-[0.5rem] rounded-full ${
              pontosCalculados > 0
                ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                : 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
            }`}
          ></span>
          <span
            className={`font-semibold text-[0.6875rem] ${
              percentualPerdidos <= 1.0
                ? 'text-emerald-500 dark:text-emerald-400'
                : percentualPerdidos <= 2.0
                ? 'text-amber-500 dark:text-amber-400'
                : 'text-rose-500 dark:text-rose-400'
            }`}
          >
            {percentualPerdidos === 0
              ? '✨ Zero perdas na equipe'
              : percentualPerdidos <= 1.0
              ? 'Meta Atingida (≤ 1,0%)'
              : percentualPerdidos <= 2.0
              ? 'Faixa Tolerada (≤ 2,0%)'
              : 'Acima do Limite (> 2,0%)'}
          </span>
        </div>
        <span
          className={`font-black text-[0.75rem] ${
            pontosCalculados > 0 ? 'text-primary' : 'text-amber-500 dark:text-amber-400'
          }`}
        >
          {pontosCalculados.toFixed(1)} / 21,0 pts
        </span>
      </div>
    </BentoCard>
  );
};
