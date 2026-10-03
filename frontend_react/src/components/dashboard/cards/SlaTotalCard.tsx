import React, { useMemo } from 'react';
import { BentoCard } from '../../ui/BentoCard';
import { ArrowUpRight } from 'lucide-react';
import { SegmentoType } from '../../common/SegmentoFilterPill';

export interface SlaTotalCardProps {
  slaTotal: number;
  slaGov?: number;
  slaCorp?: number;
  pontosSla?: number;
  selectedSegmento?: SegmentoType;
  onSelectSegmento?: (seg: SegmentoType) => void;
  // Propriedades Bimodais (Individual vs. Equipe)
  canToggleMode?: boolean;
  slaMode?: 'individual' | 'equipe';
  onToggleMode?: (mode: 'individual' | 'equipe') => void;
  operacaoNome?: string;
  slaIndividualTotal?: number;
  slaIndividualGov?: number;
  slaIndividualCorp?: number;
  pontosSlaIndividual?: number;
  onOpenDetailsModal: () => void;
  className?: string;
}

export const SlaTotalCard: React.FC<SlaTotalCardProps> = ({
  slaTotal,
  slaGov,
  slaCorp,
  pontosSla,
  selectedSegmento = 'Total',
  canToggleMode = true,
  slaMode = 'equipe',
  onToggleMode,
  operacaoNome,
  slaIndividualTotal,
  slaIndividualGov,
  slaIndividualCorp,
  pontosSlaIndividual,
  onOpenDetailsModal,
  className = ''
}) => {
  const slaExibicao = useMemo(() => {
    const isIndiv = slaMode === 'individual';
    const total = isIndiv ? (slaIndividualTotal ?? slaTotal) : slaTotal;
    const gov = isIndiv ? (slaIndividualGov ?? slaGov) : slaGov;
    const corp = isIndiv ? (slaIndividualCorp ?? slaCorp) : slaCorp;

    if (selectedSegmento === 'Gov') return gov ?? total;
    if (selectedSegmento === 'Corp') return corp ?? total;
    return total;
  }, [slaMode, selectedSegmento, slaTotal, slaGov, slaCorp, slaIndividualTotal, slaIndividualGov, slaIndividualCorp]);

  // Pontos de SLA calculados conforme a regra oficial:
  // Meta: >= 90% (Gatilho da Equipe)
  // >= 100%: 33.5 pts
  // 90% a 99.99%: 29.0 pts
  // < 90%: 0.0 pts
  const pontosCalculados = useMemo(() => {
    if (slaMode === 'equipe') {
      if (pontosSla !== undefined && pontosSla !== null) {
        return Number(pontosSla);
      }
    } else {
      if (pontosSlaIndividual !== undefined && pontosSlaIndividual !== null) {
        return Number(pontosSlaIndividual);
      }
    }
    if (slaExibicao >= 100.0) return 33.5;
    if (slaExibicao >= 90.0) return 29.0;
    return 0.0;
  }, [slaMode, pontosSla, pontosSlaIndividual, slaExibicao]);

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
      title="Clique para ver o detalhamento completo dos KPIs (SLA Máx: 33,5 pts)"
    >
      {/* Cabeçalho Padronizado: Pílula 'SLA da Operação/Individual' + Badge Pontuação + Seletor Bimodal + Botão Ação */}
      <div className="flex flex-col gap-[0.375rem]">
        <div className="flex items-center justify-between gap-[0.5rem]">
          <div className="flex items-center gap-[0.5rem]">
            <div className="inline-flex items-center px-[0.75rem] py-[0.25rem] rounded-full bg-light-surface-elevated/90 dark:bg-surface-elevated/80 border border-light-border dark:border-white/10 text-[0.75rem] font-bold text-light-text-main dark:text-text-main shadow-xs">
              {slaMode === 'equipe' ? 'SLA da Operação' : 'SLA Individual'}
            </div>
            {selectedSegmento !== 'Total' && (
              <span className="text-[0.625rem] font-black uppercase tracking-wider px-[0.5rem] py-[0.125rem] rounded-full bg-primary/15 text-primary border border-primary/30">
                {selectedSegmento}
              </span>
            )}
            {/* Badge de Pontuação Oficial do Indicador (Máx 33,5 pts) */}
            <div className="inline-flex items-center gap-[0.25rem] px-[0.625rem] py-[0.25rem] rounded-full bg-primary/10 border border-primary/25 text-primary text-[0.75rem] font-black shadow-xs">
              <span>{pontosCalculados.toFixed(1)}</span>
              <span className="text-[0.625rem] text-light-text-muted dark:text-text-muted font-normal">/ 33,5 pts</span>
            </div>
          </div>

          <div className="flex items-center gap-[0.5rem]">
            {/* Seletor Bimodal Individual | Equipe idêntico ao Card 5 */}
            {canToggleMode && onToggleMode && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center p-[0.125rem] rounded-[0.5rem] bg-light-surface-elevated dark:bg-surface border border-light-border dark:border-border text-[0.625rem] font-bold"
              >
                <button
                  type="button"
                  onClick={() => onToggleMode('individual')}
                  className={`px-[0.5rem] py-[0.125rem] rounded-[0.375rem] border transition-all cursor-pointer ${
                    slaMode === 'individual'
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
                    slaMode === 'equipe'
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
                onOpenDetailsModal();
              }}
              className="w-[2rem] h-[2rem] rounded-full bg-light-surface-elevated dark:bg-surface-elevated hover:bg-primary/20 text-light-text-muted dark:text-text-muted hover:text-primary flex items-center justify-center transition-colors cursor-pointer border border-light-border dark:border-border"
              title="Ver detalhamento completo dos chamados SLA"
            >
              <ArrowUpRight size={16} />
            </button>
          </div>
        </div>

        {/* Subtítulo Contextual da Base ou Atendimento Próprio */}
        {slaMode === 'equipe' && operacaoNome ? (
          <div className="flex items-center gap-[0.375rem] px-[0.25rem]">
            <span className="w-[0.375rem] h-[0.375rem] rounded-full bg-primary animate-pulse" />
            <span className="text-[0.6875rem] font-medium text-light-text-muted dark:text-text-muted truncate">
              {operacaoNome}
            </span>
          </div>
        ) : slaMode === 'individual' ? (
          <div className="flex items-center gap-[0.375rem] px-[0.25rem]">
            <span className="w-[0.375rem] h-[0.375rem] rounded-full bg-primary/60" />
            <span className="text-[0.6875rem] font-medium text-light-text-muted dark:text-text-muted">
              Atendimentos Próprios do Colaborador
            </span>
          </div>
        ) : null}
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

      {/* Rodapé: Exibição da Meta de SLA, Status e Pontuação Oficial */}
      <div className="space-y-[0.375rem] pt-[0.5rem] border-t border-light-border dark:border-border/60">
        <div className="flex items-center justify-between text-[0.75rem]">
          <div className="flex items-center gap-[0.5rem]">
            <span className="w-[0.5rem] h-[0.5rem] rounded-full bg-primary shadow-glow-primary-sm"></span>
            <span className="text-light-text-muted dark:text-text-muted font-medium">Meta Oficial</span>
          </div>
          <span className="font-bold text-light-text-main dark:text-text-main">≥ 90.0% (Gatilho)</span>
        </div>
        <div className="flex items-center justify-between text-[0.75rem]">
          <div className="flex items-center gap-[0.5rem]">
            <span
              className={`w-[0.5rem] h-[0.5rem] rounded-full ${
                pontosCalculados > 0
                  ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                  : 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
              }`}
            ></span>
            <span className="text-light-text-muted dark:text-text-muted font-medium">
              Pontuação SLA {slaMode === 'individual' ? '(Indiv.)' : '(Equipe)'}
            </span>
          </div>
          <span
            className={`font-black ${
              pontosCalculados > 0
                ? 'text-primary'
                : 'text-amber-500 dark:text-amber-400'
            }`}
          >
            {pontosCalculados.toFixed(1)} / 33,5 pts
          </span>
        </div>
      </div>
    </BentoCard>
  );
};
