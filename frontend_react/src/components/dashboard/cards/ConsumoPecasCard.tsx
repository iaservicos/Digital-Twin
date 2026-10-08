import React, { useMemo } from 'react';
import { BentoCard } from '../../ui/BentoCard';
import { ArrowUpRight } from 'lucide-react';

export interface ConsumoPecasCardProps {
  totalPecasElegiveis: number;
  percentualConsumo?: number;
  pontosPecas?: number;
  pecasChart: { key?: string; label?: string; nome?: string; qtd: number; pct: number }[];
  onOpenPecasModal: () => void;
  className?: string;
}

export const ConsumoPecasCard: React.FC<ConsumoPecasCardProps> = ({
  totalPecasElegiveis,
  percentualConsumo,
  pontosPecas,
  pecasChart,
  onOpenPecasModal,
  className = ''
}) => {
  const maxPecaQtd = useMemo(() => {
    return Math.max(...pecasChart.map((p) => p.qtd), 1);
  }, [pecasChart]);

  // Pontuação oficial conforme regra de negócio:
  // Meta: <= 25.0% de consumo -> 13.5 pts | > 25.0% -> 0.0 pts
  const pontosCalculados = useMemo(() => {
    if (pontosPecas !== undefined && pontosPecas !== null) {
      return Number(pontosPecas);
    }
    if (percentualConsumo !== undefined) {
      return percentualConsumo <= 25.0 ? 13.5 : 0.0;
    }
    return 13.5;
  }, [pontosPecas, percentualConsumo]);

  return (
    <BentoCard
      hoverable
      className={`min-h-[19.5rem] sm:min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between ${className}`}
      title="Detalhamento de consumo de peças da campanha (Tela LCD, SSD, HD e PLM — Máx: 13,5 pts)"
    >
      <div className="flex items-center justify-between gap-[0.375rem] flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-[0.375rem]">
          <div className="inline-flex items-center px-[0.625rem] py-[0.1875rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.6875rem] sm:text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
            Consumo de peças
          </div>
          {/* Badge de Pontuação Oficial */}
          <div className="inline-flex items-center gap-[0.25rem] px-[0.5rem] py-[0.1875rem] rounded-full bg-primary/10 border border-primary/25 text-primary text-[0.6875rem] sm:text-[0.75rem] font-black shadow-xs">
            <span>{pontosCalculados.toFixed(1)}</span>
            <span className="text-[0.5625rem] sm:text-[0.625rem] text-light-text-muted dark:text-text-muted font-normal">/ 13,5 pts</span>
          </div>
        </div>

        <div className="flex items-center gap-[0.375rem] shrink-0">
          <span className="text-[0.625rem] sm:text-[0.6875rem] text-primary font-bold whitespace-nowrap">
            {totalPecasElegiveis} {totalPecasElegiveis === 1 ? 'peça' : 'peças'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPecasModal();
            }}
            className="w-[1.75rem] h-[1.75rem] sm:w-[2rem] sm:h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
            title="Ver detalhamento de peças da campanha"
          >
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      {/* Histograma Vertical das 4 Peças: Tela LCD, SSD, HD e PLM */}
      <div className="flex items-end justify-between gap-[0.5rem] sm:gap-[0.75rem] h-[9rem] 2xl:h-[10rem] pt-[0.75rem] pb-[0.25rem]">
        {pecasChart.map((peca) => {
          const isHighlight = peca.qtd > 0 && peca.qtd === maxPecaQtd;
          const barHeightPct =
            peca.qtd === 0
              ? 10
              : Math.max(16, Math.min(75, Math.round((peca.qtd / (maxPecaQtd || 1)) * 62) + 12));
          const displayName = peca.label || peca.nome || peca.key || '';

          return (
            <div key={peca.key || displayName} className="flex-1 flex flex-col items-center justify-end h-full group min-w-0">
              <span className="text-[0.625rem] sm:text-[0.6875rem] font-black text-light-text-main dark:text-text-main group-hover:text-primary transition-colors truncate">
                {peca.qtd}
              </span>
              <span className="text-[0.5rem] sm:text-[0.5625rem] text-light-text-muted dark:text-text-muted font-bold mb-[0.1875rem]">
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
                className="text-[0.5625rem] sm:text-[0.625rem] font-bold text-light-text-muted dark:text-text-muted truncate max-w-[3.5rem] sm:max-w-[4rem] text-center mt-[0.375rem]"
                title={displayName}
              >
                {displayName}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-[0.5rem] border-t border-light-border dark:border-border/60 flex items-center justify-between text-[0.6875rem] sm:text-[0.75rem] gap-[0.5rem]">
        <div className="flex items-center gap-[0.375rem] min-w-0">
          <span
            className={`w-[0.5rem] h-[0.5rem] rounded-full shrink-0 ${
              pontosCalculados > 0
                ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                : 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
            }`}
          ></span>
          <span
            className={`font-semibold truncate ${
              pontosCalculados > 0
                ? 'text-emerald-500 dark:text-emerald-400'
                : 'text-amber-500 dark:text-amber-400'
            }`}
          >
            {pontosCalculados > 0
              ? (percentualConsumo !== undefined ? `Meta Atingida (${percentualConsumo.toFixed(1)}% ≤ 25,0%)` : 'Meta Atingida (≤ 25,0%)')
              : (percentualConsumo !== undefined ? `Acima da Meta (${percentualConsumo.toFixed(1)}% > 25,0%)` : 'Acima da Meta (> 25,0%)')}
          </span>
        </div>
        <span
          className={`font-black shrink-0 ${
            pontosCalculados > 0 ? 'text-primary' : 'text-amber-500 dark:text-amber-400'
          }`}
        >
          {pontosCalculados.toFixed(1)} / 13,5 pts
        </span>
      </div>
    </BentoCard>
  );
};
