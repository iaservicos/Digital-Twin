import React, { useState } from 'react';
import { Award, TrendingUp, CheckCircle2, Medal, XCircle } from 'lucide-react';
import { CircularProgress } from '../ui/CircularProgress';
import ChamadosHistoryCard from './ChamadosHistoryCard';
import { ModalDetalhesPontuacao } from './ModalDetalhesPontuacao';
import { ModalElegivel } from './ModalElegivel';
import { ModalInelegivel } from './ModalInelegivel';

interface TecnicoMetricsUIProps {
  metricas: any;
  displayMetricas: any;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

export const TecnicoMetricsUI: React.FC<TecnicoMetricsUIProps> = ({
  metricas,
  displayMetricas,
  selectedMonth,
  setSelectedMonth
}) => {
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isElegivelModalOpen, setIsElegivelModalOpen] = useState(false);
  const [isInelegivelModalOpen, setIsInelegivelModalOpen] = useState(false);

  if (!displayMetricas) return null;

  const percentualConsumo = displayMetricas.percentualEficienciaPecas || 0;
  const percentualSla = displayMetricas.percentualSla || 0;
  const percentualReincidencia = displayMetricas.percentualReincidencia || 0;
  const pontuacaoTotal = displayMetricas.pontosTotal || 0;
  


  return (
    <div className="space-y-6 pb-6 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-light-text-main dark:text-text-main">Dashboard de Performance</h1>
          <p className="text-sm text-light-text-muted dark:text-text-muted mt-1">
            Indicadores e ranking em tempo real.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {displayMetricas.elegivel ? (
            <button
              onClick={() => setIsElegivelModalOpen(true)}
              className="flex items-center space-x-2 bg-transparent border border-accent-emerald text-accent-emerald px-4 py-2 rounded-full font-medium text-sm hover:bg-accent-emerald/10 transition-colors">
              <CheckCircle2 size={16} />
              <span>Elegível para Premiação</span>
            </button>
          ) : (
            <button
              onClick={() => setIsInelegivelModalOpen(true)}
              className="flex items-center space-x-2 bg-transparent border border-status-danger text-status-danger px-4 py-2 rounded-full font-medium text-sm hover:bg-status-danger/10 transition-colors">
              <XCircle size={16} />
              <span>Não Elegível</span>
            </button>
          )}
          {displayMetricas.posicaoRanking && displayMetricas.posicaoRanking !== '--' && (
            <span className="text-xs font-bold text-light-text-muted bg-slate-100 dark:bg-surface px-3 py-1 rounded-full flex items-center shadow-sm">
              <Medal size={12} className="mr-1 text-accent-teal" /> Ranking: {displayMetricas.posicaoRanking}º Lugar
            </span>
          )}
        </div>
      </div>

      {/* Seletor de Mês (Segmented Control) */}
      {metricas?.historico && metricas.historico.length > 0 && (
        <div className="flex justify-center mt-2 mb-8">
          <div className="inline-flex bg-slate-100 dark:bg-background/80 p-1.5 rounded-full border border-light-borderStrong dark:border-border/50 shadow-inner overflow-x-auto max-w-full scrollbar-hide">
            <button
              key="media-final"
              onClick={() => setSelectedMonth('')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                !selectedMonth || selectedMonth === 'Média Final'
                  ? 'bg-light-surface dark:bg-surface text-accent-teal shadow-md border border-light-borderStrong/50 dark:border-border transform scale-105'
                  : 'text-light-text-muted dark:text-light-text-muted hover:text-light-text-secondary dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-surface/50'
              }`}
            >
              Campanha Inteira
            </button>
            {metricas.historico
              .filter((h: any) => h.mes !== 'Média Final')
              .map((h: any, idx: number) => {
                const targetValue = h.mesReferencia || h.mes;
                const isSelected = selectedMonth === targetValue || selectedMonth === h.mes;
                return (
                  <button
                    key={`${h.mes}-${h.mesReferencia || idx}`}
                    onClick={() => setSelectedMonth(targetValue)}
                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                      isSelected
                        ? 'bg-light-surface dark:bg-surface text-accent-teal shadow-md border border-light-borderStrong/50 dark:border-border transform scale-105'
                        : 'text-light-text-muted dark:text-light-text-muted hover:text-light-text-secondary dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-surface/50'
                    }`}
                  >
                    {h.mes}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Top Grid: Pontuação & Últimos Chamados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div
          onClick={() => setDetailsModalOpen(true)}
          className="bg-gradient-to-br from-light-surface to-slate-50 dark:from-slate-800 dark:to-background rounded-positivo-lg p-6 border border-light-borderStrong dark:border-border shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden group cursor-pointer hover:border-accent-teal/50 hover:shadow-2xl hover:shadow-accent-teal/20 transition-all duration-300"
        >
          <div className="absolute -right-6 -top-6 text-light-text-secondary/30 dark:text-light-text-secondary/20 transform group-hover:scale-110 transition-transform duration-500">
            <Award size={120} />
          </div>
          <h3 className="text-sm font-medium text-light-text-secondary dark:text-slate-300 mb-2 z-10 uppercase tracking-widest">Pontuação Total</h3>
          <div className="flex items-baseline gap-1 z-10">
            <span className="text-6xl font-black text-light-text-main dark:text-text-main">{pontuacaoTotal}</span>
            <span className="text-lg text-light-text-muted font-bold">/100</span>
          </div>
          <div className="mt-4 bg-light-surface/10 backdrop-blur px-4 py-1.5 rounded-full z-10">
            <p className="text-xs text-light-text-secondary dark:text-slate-200 font-medium flex items-center">
              <TrendingUp size={14} className="mr-1 text-accent-emerald" />
              Sua performance global
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          {displayMetricas.idTecnico && (
            <ChamadosHistoryCard tecnicoId={displayMetricas.idTecnico} />
          )}
        </div>
      </div>

      {/* Grid Inferior: 6 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Card SLA */}
        <div className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-accent-teal/30 transition-colors">
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-surface text-light-text-muted px-2 py-0.5 rounded-full mb-1">EQUIPE</span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider">SLA</h3>
          </div>
          <CircularProgress
            value={percentualSla}
            maxValue={100}
            color="#0891b2"
            label={percentualSla.toFixed(1)}
            isPercentage={true}
          />
          <p className="text-[10px] text-light-text-muted mt-1">Meta: ≥ 90%</p>
        </div>

        {/* 2. Card Reincidência (Equipe) */}
        <div className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-status-danger/30 transition-colors">
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-surface text-light-text-muted px-2 py-0.5 rounded-full mb-1">EQUIPE</span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider">Reinc. (Eqp)</h3>
          </div>
          <CircularProgress
            value={displayMetricas.percentualReincidenciaEquipe || 0}
            maxValue={100}
            color="#EF4444"
            label={(displayMetricas.percentualReincidenciaEquipe || 0).toFixed(1)}
            isPercentage={true}
          />
          <p className="text-[10px] text-light-text-muted mt-1">Meta: {'<'} 7%</p>
        </div>

        {/* 3. Card Reincidência (Individual) */}
        <div className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-pink-500/30 transition-colors">
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-pink-500/10 text-pink-500 px-2 py-0.5 rounded-full mb-1">INDIVIDUAL</span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider">Reinc. (Ind)</h3>
          </div>
          <CircularProgress
            value={percentualReincidencia}
            maxValue={100}
            color="#ec4899"
            label={percentualReincidencia.toFixed(1)}
            isPercentage={true}
          />
          <p className="text-[10px] text-light-text-muted mt-1">Gatilho Prata</p>
        </div>

        {/* 4. Card Perdas SLA */}
        <div className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-orange-400/30 transition-colors">
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-surface text-light-text-muted px-2 py-0.5 rounded-full mb-1">EQUIPE</span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider">Perdas</h3>
          </div>
          <CircularProgress
            value={displayMetricas.percentualPerdidos || 0}
            maxValue={100}
            color="#fb923c"
            label={(displayMetricas.percentualPerdidos || 0).toFixed(1)}
            isPercentage={true}
          />
          <p className="text-[10px] text-light-text-muted mt-1">Meta: Minimizar</p>
        </div>

        {/* 5. Card Avaliação NPS */}
        <div className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-indigo-400/30 transition-colors">
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full mb-1">INDIVIDUAL</span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider">NPS</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <p className="text-4xl font-bold text-indigo-400">{displayMetricas.npsScore?.toFixed(1) || '0.0'}</p>
            <p className="text-xs text-status-success font-medium mt-1">+{displayMetricas.pontosNps || 0} pts</p>
          </div>
          <p className="text-[10px] text-light-text-muted mt-1">Satisfação do cliente</p>
        </div>

        {/* 6. Card Peças */}
        <div className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-accent-teal/30 transition-colors">
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-surface text-light-text-muted px-2 py-0.5 rounded-full mb-1">EQUIPE</span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider">Peças</h3>
          </div>
          <CircularProgress
            value={percentualConsumo}
            maxValue={100}
            color="#0891b2"
            label={percentualConsumo.toFixed(1)}
            isPercentage={true}
          />
          <p className="text-[10px] text-light-text-muted mt-1">Desempenho da base</p>
        </div>
      </div>

      <ModalDetalhesPontuacao 
        isOpen={detailsModalOpen} 
        onClose={() => setDetailsModalOpen(false)} 
        metricas={displayMetricas}
      />
      
      <ModalElegivel 
        isOpen={isElegivelModalOpen} 
        onClose={() => setIsElegivelModalOpen(false)} 
        premioAtual={getPremioInfo(pontuacaoTotal)}
        pontuacaoTotal={pontuacaoTotal}
      />
      
      <ModalInelegivel 
        isOpen={isInelegivelModalOpen} 
        onClose={() => setIsInelegivelModalOpen(false)} 
        motivoInelegibilidade={displayMetricas.motivoInelegibilidade || "Não atingiu os critérios mínimos do mês."}
      />
    </div>
  );
};

// Auxiliary function moved outside
function getPremioInfo(pontos: number) {
  if (pontos >= 90) return { titulo: '1º Prêmio', valor: 'R$ 300,00' };
  if (pontos >= 80) return { titulo: '2º Prêmio', valor: 'R$ 200,00' };
  if (pontos >= 70) return { titulo: '3º Prêmio', valor: 'R$ 100,00' };
  return null;
}
