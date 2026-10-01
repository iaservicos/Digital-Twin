import React from 'react';
import { BentoCard } from '../../ui/BentoCard';
import CartesianWaveChart from '../CartesianWaveChart';
import { ArrowUpRight } from 'lucide-react';

export interface PerdasFalhaTecnicaCardProps {
  percentualPerdidos: number;
  perdasQtd?: number;
  chartData: { label: string; value: number }[];
  onOpenPerdasModal: () => void;
  className?: string;
}

export const PerdasFalhaTecnicaCard: React.FC<PerdasFalhaTecnicaCardProps> = ({
  percentualPerdidos,
  perdasQtd,
  chartData,
  onOpenPerdasModal,
  className = ''
}) => {
  return (
    <BentoCard
      hoverable
      onClick={onOpenPerdasModal}
      className={`min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between hover:border-amber-500/50 hover:shadow-amber-500/10 ${className}`}
      title="Chamados com erro de gestão ou transferência que geraram perda de SLA (Meta: ≤ 1.0%)"
    >
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center px-[0.75rem] py-[0.25rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
          Perdas - Falha técnica
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
          Falhas de Gestão & Transferência (Meta: ≤ 1.0%)
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
        {percentualPerdidos === 0 ? (
          <span className="font-bold text-[0.6875rem] text-emerald-500 dark:text-emerald-400 flex items-center gap-[0.25rem]">
            <span>✨ Parabéns! Zero perdas registradas</span>
          </span>
        ) : (
          <span
            className={`font-semibold text-[0.6875rem] ${
              percentualPerdidos <= 1.0
                ? 'text-emerald-500 dark:text-emerald-400'
                : 'text-amber-500 dark:text-amber-400'
            }`}
          >
            {percentualPerdidos <= 1.0 ? 'Dentro da meta operacional' : 'Acima do limite tolerado'}
          </span>
        )}
        <span className="text-light-text-muted dark:text-text-muted text-[0.625rem]">
          Meta: ≤ 1.0%
        </span>
      </div>
    </BentoCard>
  );
};
