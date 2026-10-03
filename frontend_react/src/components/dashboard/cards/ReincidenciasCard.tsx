import React, { useMemo } from 'react';
import { BentoCard } from '../../ui/BentoCard';
import CartesianWaveChart from '../CartesianWaveChart';
import { ArrowUpRight } from 'lucide-react';

export interface ReincidenciasCardProps {
  percentualReincidencia: number;
  reincidenciaQtd?: number;
  pontosReincidencia?: number;
  pontosReincidenciaEquipe?: number;
  chartData: { label: string; value: number }[];
  canToggleEquipe?: boolean;
  reincidenciaMode?: 'individual' | 'equipe';
  onToggleMode?: (mode: 'individual' | 'equipe') => void;
  onOpenReincidentesModal: () => void;
  className?: string;
}

export const ReincidenciasCard: React.FC<ReincidenciasCardProps> = ({
  percentualReincidencia,
  reincidenciaQtd,
  pontosReincidencia,
  pontosReincidenciaEquipe,
  chartData,
  canToggleEquipe = false,
  reincidenciaMode = 'individual',
  onToggleMode,
  onOpenReincidentesModal,
  className = ''
}) => {
  // Pontuação oficial conforme a regra:
  // Meta: <= 7.0% -> 16.0 pts | 7.1% a 10.0% -> 11.0 pts | > 10.0% -> 0.0 pts
  const pontosAtivos = useMemo(() => {
    if (reincidenciaMode === 'equipe') {
      if (pontosReincidenciaEquipe !== undefined && pontosReincidenciaEquipe !== null) {
        return Number(pontosReincidenciaEquipe);
      }
    } else {
      if (pontosReincidencia !== undefined && pontosReincidencia !== null) {
        return Number(pontosReincidencia);
      }
    }
    if (percentualReincidencia <= 7.0) return 16.0;
    if (percentualReincidencia <= 10.0) return 11.0;
    return 0.0;
  }, [reincidenciaMode, pontosReincidencia, pontosReincidenciaEquipe, percentualReincidencia]);

  return (
    <BentoCard
      hoverable
      onClick={onOpenReincidentesModal}
      className={`min-h-[22.5rem] 2xl:min-h-[25rem] flex flex-col justify-between ${className}`}
      title="Clique para ver a análise detalhada de reincidências (Máx: 16,0 pts)"
    >
      <div className="flex items-center justify-between gap-[0.5rem]">
        <div className="flex items-center gap-[0.5rem]">
          <div className="inline-flex items-center px-[0.75rem] py-[0.25rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
            Reincidências
          </div>
          {/* Badge de Pontuação Oficial */}
          <div className="inline-flex items-center gap-[0.25rem] px-[0.625rem] py-[0.25rem] rounded-full bg-primary/10 border border-primary/25 text-primary text-[0.75rem] font-black shadow-xs">
            <span>{pontosAtivos.toFixed(1)}</span>
            <span className="text-[0.625rem] text-light-text-muted dark:text-text-muted font-normal">/ 16,0 pts</span>
          </div>
        </div>

        <div className="flex items-center gap-[0.5rem]">
          {canToggleEquipe && onToggleMode && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center p-[0.125rem] rounded-[0.5rem] bg-light-surface-elevated dark:bg-surface border border-light-border dark:border-border text-[0.625rem] font-bold"
            >
              <button
                type="button"
                onClick={() => onToggleMode('individual')}
                className={`px-[0.5rem] py-[0.125rem] rounded-[0.375rem] border transition-all cursor-pointer ${
                  reincidenciaMode === 'individual'
                    ? 'bg-primary text-background border-primary shadow-xs'
                    : 'bg-transparent border-transparent text-light-text-muted dark:text-text-muted hover:text-light-textHover dark:hover:text-textHover'
                }`}
              >
                Individual
              </button>
              <button
                type="button"
                onClick={() => onToggleMode('equipe')}
                className={`px-[0.5rem] py-[0.125rem] rounded-[0.375rem] border transition-all cursor-pointer ${
                  reincidenciaMode === 'equipe'
                    ? 'bg-primary text-background border-primary shadow-xs'
                    : 'bg-transparent border-transparent text-light-text-muted dark:text-text-muted hover:text-light-textHover dark:hover:text-textHover'
                }`}
              >
                Equipe
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReincidentesModal();
            }}
            className="w-[2rem] h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
            title="Ver análise detalhada de reincidências"
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      <div className="pt-[0.5rem]">
        <div className="flex items-baseline gap-[0.5rem]">
          <p className="text-[1.875rem] 2xl:text-[2.25rem] font-black text-light-text-main dark:text-text-main tracking-tight leading-none">
            {percentualReincidencia.toFixed(1)}%
          </p>
          {reincidenciaQtd !== undefined && (
            <span className="text-[0.75rem] text-light-text-muted dark:text-text-muted font-semibold">
              ({reincidenciaQtd} retornos)
            </span>
          )}
        </div>
        <p className="text-[0.6875rem] text-light-text-muted dark:text-text-muted font-medium mt-[0.25rem]">
          {reincidenciaMode === 'equipe'
            ? 'Retornos da Equipe em 30 Dias (Meta: ≤ 7.0% • Gatilho)'
            : 'Taxa de Retorno Individual (Meta: ≤ 7.0%)'}
        </p>
      </div>

      {/* Gráfico Cartesiano com Curva Neon (Altura calibrada em REM) */}
      <div className="w-full pt-[0.5rem]">
        <CartesianWaveChart
          data={chartData}
          gradientId="reincidenciasWaveGrad"
          height="7.5rem"
        />
      </div>

      <div className="pt-[0.5rem] border-t border-light-border dark:border-border/60 flex items-center justify-between text-[0.75rem]">
        <div className="flex items-center gap-[0.375rem]">
          <span
            className={`w-[0.5rem] h-[0.5rem] rounded-full ${
              pontosAtivos > 0
                ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                : 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
            }`}
          ></span>
          <span
            className={`font-semibold text-[0.6875rem] ${
              percentualReincidencia <= 7.0
                ? 'text-emerald-500 dark:text-emerald-400'
                : percentualReincidencia <= 10.0
                ? 'text-amber-500 dark:text-amber-400'
                : 'text-rose-500 dark:text-rose-400'
            }`}
          >
            {percentualReincidencia <= 7.0
              ? 'Meta Atingida (≤ 7,0%)'
              : percentualReincidencia <= 10.0
              ? 'Faixa Tolerada (≤ 10,0%)'
              : 'Acima do Limite (> 10,0%)'}
          </span>
        </div>
        <span
          className={`font-black text-[0.75rem] ${
            pontosAtivos > 0 ? 'text-primary' : 'text-amber-500 dark:text-amber-400'
          }`}
        >
          {pontosAtivos.toFixed(1)} / 16,0 pts
        </span>
      </div>
    </BentoCard>
  );
};
