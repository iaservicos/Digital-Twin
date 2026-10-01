import React, { useMemo } from 'react';
import { BentoCard } from '../../ui/BentoCard';
import { ArrowUpRight } from 'lucide-react';

export interface ConsumoPecasCardProps {
  totalPecasElegiveis: number;
  pecasChart: { key?: string; label?: string; nome?: string; qtd: number; pct: number }[];
  onOpenPecasModal: () => void;
  className?: string;
}

export const ConsumoPecasCard: React.FC<ConsumoPecasCardProps> = ({
  totalPecasElegiveis,
  pecasChart,
  onOpenPecasModal,
  className = ''
}) => {
  const maxPecaQtd = useMemo(() => {
    return Math.max(...pecasChart.map((p) => p.qtd), 1);
  }, [pecasChart]);

  return (
    <BentoCard
      hoverable
      onClick={onOpenPecasModal}
      className={`min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between ${className}`}
      title="Clique para ver o detalhamento de peças da campanha (Tela LCD, SSD, HD e PLM)"
    >
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center px-[0.75rem] py-[0.25rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
          Consumo de peças
        </div>
        <div className="flex items-center gap-[0.5rem]">
          <span className="text-[0.6875rem] text-primary font-bold">
            {totalPecasElegiveis} {totalPecasElegiveis === 1 ? 'peça aplicada' : 'peças aplicadas'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPecasModal();
            }}
            className="w-[2rem] h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
            title="Ver detalhamento de peças da campanha"
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {/* Histograma Vertical das 4 Peças: Tela LCD, SSD, HD e PLM */}
      <div className="flex items-end justify-between gap-[0.75rem] h-[9rem] 2xl:h-[10rem] pt-[0.75rem] pb-[0.25rem]">
        {pecasChart.map((peca) => {
          const isHighlight = peca.qtd > 0 && peca.qtd === maxPecaQtd;
          const barHeightPct =
            peca.qtd === 0
              ? 10
              : Math.max(16, Math.min(75, Math.round((peca.qtd / (maxPecaQtd || 1)) * 62) + 12));
          const displayName = peca.label || peca.nome || peca.key || '';

          return (
            <div key={peca.key || displayName} className="flex-1 flex flex-col items-center justify-end h-full group">
              <span className="text-[0.6875rem] font-black text-light-text-main dark:text-text-main group-hover:text-primary transition-colors">
                {peca.qtd}
              </span>
              <span className="text-[0.5625rem] text-light-text-muted dark:text-text-muted font-bold mb-[0.25rem]">
                {peca.pct}%
              </span>

              {/* Barra com Gradiente */}
              <div className="w-full bg-light-surface-elevated/70 dark:bg-surface-elevated/40 rounded-t-[0.5rem] p-[0.125rem] flex items-end justify-center h-[5.5rem] 2xl:h-[6.5rem]">
                <div
                  className={`w-full rounded-t-[0.375rem] transition-all duration-700 ease-out ${
                    isHighlight
                      ? 'bg-gradient-to-t from-primary/80 to-primary shadow-glow-primary-sm'
                      : peca.qtd > 0
                      ? 'bg-gradient-to-t from-primary/40 to-primary/70 group-hover:from-primary/60 group-hover:to-primary'
                      : 'bg-light-chart-track dark:bg-chart-track/50'
                  }`}
                  style={{ height: `${barHeightPct}%` }}
                />
              </div>

              <span
                className="text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted truncate max-w-[4rem] text-center mt-[0.375rem]"
                title={displayName}
              >
                {displayName}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-[0.5rem] border-t border-light-border dark:border-border/60 flex items-center justify-between text-[0.75rem]">
        <span className="text-light-text-muted dark:text-text-muted text-[0.6875rem]">
          4 grupos de peças elegíveis na campanha
        </span>
        <span className="font-bold text-primary text-[0.6875rem]">Tela • SSD • HD • PLM</span>
      </div>
    </BentoCard>
  );
};
