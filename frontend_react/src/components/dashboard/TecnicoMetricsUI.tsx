import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Award, TrendingUp, CheckCircle2, Medal, XCircle, ShieldAlert } from 'lucide-react';
import { CircularProgress } from '../ui/CircularProgress';
import ChamadosHistoryCard from './ChamadosHistoryCard';
import { ModalDetalhesPontuacao } from './ModalDetalhesPontuacao';
import { ModalElegivel } from './ModalElegivel';
import { ModalInelegivel } from './ModalInelegivel';
import ModalChamadosReincidentes from './ModalChamadosReincidentes';
import ModalChamadosSlaPerdidos from './ModalChamadosSlaPerdidos';
import ModalChamadosPerdas from './ModalChamadosPerdas';

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
  const user = useAuthStore(state => state.user);
  const isSupervisorOrAdmin = ['SUPERVISOR', 'MODERADOR', 'ADMIN', 'ROLE_SUPERVISOR', 'ROLE_MODERADOR', 'ROLE_ADMIN'].includes((user?.role || '').toUpperCase());

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [isReincidentesModalOpen, setIsReincidentesModalOpen] = useState(false);
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  const [isPerdasModalOpen, setIsPerdasModalOpen] = useState(false);
  const [isElegivelModalOpen, setIsElegivelModalOpen] = useState(false);
  const [isInelegivelModalOpen, setIsInelegivelModalOpen] = useState(false);

  if (!displayMetricas) return null;

  const percentualConsumo = displayMetricas.percentualEficienciaPecas || 0;
  const percentualSla = displayMetricas.percentualSla || 0;
  const percentualReincidencia = displayMetricas.percentualReincidencia || 0;
  const pontuacaoTotal = displayMetricas.pontosTotal || 0;

  const selLower = (selectedMonth || '').trim().toLowerCase();
  const isCampanhaInteira = !selLower || selLower === 'campanha inteira' || selLower === 'média final' || selLower === '2026-08-31';

  return (
    <div className="space-y-6 pb-6 w-full">
      {/* Header do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-light-text-main dark:text-text-main">Dashboard de Performance</h1>
          <p className="text-sm text-light-text-muted dark:text-text-muted mt-1 font-medium">
            {displayMetricas.tecnico || 'Técnico'}{displayMetricas.localEquipe ? ` - ${displayMetricas.localEquipe}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {displayMetricas.elegivel ? (
            <button
              onClick={() => setIsElegivelModalOpen(true)}
              className="flex items-center space-x-2 bg-transparent border border-accent-emerald text-accent-emerald px-4 py-2 rounded-full font-medium text-sm hover:bg-accent-emerald/10 transition-colors cursor-pointer">
              <CheckCircle2 size={16} />
              <span>Elegível para Premiação</span>
            </button>
          ) : (
            <button
              onClick={() => setIsInelegivelModalOpen(true)}
              className="flex items-center space-x-2 bg-transparent border border-status-danger text-status-danger px-4 py-2 rounded-full font-medium text-sm hover:bg-status-danger/10 transition-colors cursor-pointer">
              <XCircle size={16} />
              <span>Não Elegível</span>
            </button>
          )}
        </div>
      </div>

      {/* Seletor de Mês em Pílula (Segmented Control) */}
      {metricas?.historico && metricas.historico.length > 0 && (
        <div className="flex justify-center mt-2 mb-8">
          <div className="inline-flex bg-slate-100 dark:bg-background/80 p-1.5 rounded-full border border-light-borderStrong dark:border-border/50 shadow-inner overflow-x-auto max-w-full scrollbar-hide">
            <button
              key="campanha-inteira"
              onClick={() => setSelectedMonth('Campanha Inteira')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
                isCampanhaInteira
                  ? 'bg-light-surface dark:bg-surface text-accent-teal shadow-md border border-light-borderStrong/50 dark:border-border transform scale-105'
                  : 'text-light-text-muted dark:text-light-text-muted hover:text-light-text-secondary dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-surface/50'
              }`}
            >
              Campanha Inteira
            </button>
            {metricas.historico
              .filter((h: any) => h.mes !== 'Média Final')
              .map((h: any, idx: number) => {
                const labelMes = h.mes; // 'Julho', 'Agosto'
                const isSelected = !isCampanhaInteira && (
                  selLower === labelMes.toLowerCase() || 
                  selLower === (h.mesReferencia || '').toLowerCase()
                );
                return (
                  <button
                    key={`${h.mes}-${h.mesReferencia || idx}`}
                    onClick={() => setSelectedMonth(labelMes)}
                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-light-surface dark:bg-surface text-accent-teal shadow-md border border-light-borderStrong/50 dark:border-border transform scale-105'
                        : 'text-light-text-muted dark:text-light-text-muted hover:text-light-text-secondary dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-surface/50'
                    }`}
                  >
                    {labelMes}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Top Grid: Pontuação Total & Últimos Chamados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div
          onClick={() => setDetailsModalOpen(true)}
          className="bg-light-surface dark:bg-surface rounded-positivo-lg p-6 border border-light-borderStrong dark:border-border shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group cursor-pointer hover:border-accent-teal/50 hover:shadow-xl transition-all duration-300 min-h-[220px]"
        >
          <div className="absolute -right-6 -top-6 text-light-text-secondary/30 dark:text-light-text-secondary/20 transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Award size={120} />
          </div>
          <h3 className="text-xs md:text-sm font-bold text-light-text-secondary dark:text-slate-300 mb-2 z-10 uppercase tracking-widest">
            Pontuação Total
          </h3>
          <div className="flex items-baseline justify-center gap-1 z-10 my-1">
            <span className="text-6xl md:text-7xl font-black text-light-text-main dark:text-text-main tracking-tight">
              {pontuacaoTotal}
            </span>
            <span className="text-lg md:text-xl text-light-text-muted font-bold">
              /100
            </span>
          </div>
          <div className="mt-3 bg-slate-100/80 dark:bg-slate-800/80 border border-light-borderStrong/40 dark:border-border/40 backdrop-blur px-4 py-1.5 rounded-full z-10 flex items-center justify-center gap-1.5 shadow-sm">
            <TrendingUp size={14} className="text-accent-emerald" />
            <span className="text-xs text-light-text-secondary dark:text-slate-200 font-medium">
              Sua performance global
            </span>
          </div>
        </div>

        <div className="lg:col-span-2">
          {displayMetricas.idTecnico && (
            <ChamadosHistoryCard tecnicoId={displayMetricas.idTecnico || (displayMetricas as any).id || (user as any)?.idTecnico || (user as any)?.id} />
          )}
        </div>
      </div>

      {/* Grid Inferior: 6 KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Card SLA - INTERATIVO */}
        <div 
          onClick={() => setIsSlaModalOpen(true)}
          className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02] transition-all cursor-pointer group relative"
          title="Clique para ver os chamados perdidos e causas de estouro do SLA"
        >
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full mb-1 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
              EQUIPE
            </span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider group-hover:text-cyan-400 transition-colors">
              SLA
            </h3>
          </div>
          <CircularProgress
            value={percentualSla}
            maxValue={100}
            color={percentualSla < 90.0 ? '#EF4444' : '#0891b2'}
            label={percentualSla.toFixed(1)}
            isPercentage={true}
          />
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-cyan-400 font-semibold group-hover:underline">
            <span>Ver perdas</span>
            <span className="text-[11px]">→</span>
          </div>
          <p className="text-[9px] text-light-text-muted">Meta: ≥ 90%</p>
        </div>

                {/* 2. Card Reincidência (Equipe) - INTERATIVO */}
        <div 
          onClick={() => setIsReincidentesModalOpen(true)}
          className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02] transition-all cursor-pointer group relative"
          title={isSupervisorOrAdmin ? "Clique para ver todas as reincidências da equipe/base" : "Clique para ver as reincidências da equipe"}
        >
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full mb-1 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
              EQUIPE
            </span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider group-hover:text-cyan-400 transition-colors">
              Reincidência
            </h3>
          </div>
          <CircularProgress
            value={displayMetricas.percentualReincidenciaEquipe || 0}
            maxValue={100}
            color={(displayMetricas.percentualReincidenciaEquipe || 0) > 7.0 ? '#EF4444' : '#0891b2'}
            label={(displayMetricas.percentualReincidenciaEquipe || 0).toFixed(1)}
            isPercentage={true}
          />
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-cyan-400 font-semibold group-hover:underline">
            <span>Ver falhas</span>
            <span className="text-[11px]">→</span>
          </div>
          <p className="text-[9px] text-light-text-muted">Meta: &lt; 7%</p>
        </div>

        {/* 3. Card Reincidência (Individual) - INTERATIVO */}
        <div 
          onClick={() => setIsReincidentesModalOpen(true)}
          className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02] transition-all cursor-pointer group relative"
          title={isSupervisorOrAdmin ? "Clique para ver todas as reincidências da equipe/base" : "Clique para ver suas reincidências e análise de falhas"}
        >
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full mb-1 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
              INDIVIDUAL
            </span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider group-hover:text-cyan-400 transition-colors">
              REINC. (IND)
            </h3>
          </div>
          <CircularProgress
            value={percentualReincidencia}
            maxValue={100}
            color={percentualReincidencia > 7.0 ? '#EF4444' : '#0891b2'}
            label={percentualReincidencia.toFixed(1)}
            isPercentage={true}
          />
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-cyan-400 font-semibold group-hover:underline">
            <span>Ver falhas</span>
            <span className="text-[11px]">→</span>
          </div>
          <p className="text-[9px] text-light-text-muted">Meta: ≤ 7.0%</p>
        </div>

        {/* 4. Card Perdas SLA - INTERATIVO */}
        <div 
          onClick={() => setIsPerdasModalOpen(true)}
          className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02] transition-all cursor-pointer group relative"
          title={isSupervisorOrAdmin ? "Clique para ver todas as perdas da equipe/base" : "Clique para ver suas perdas por falhas de gestão / transferência"}
        >
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full mb-1 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
              EQUIPE
            </span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider group-hover:text-cyan-400 transition-colors">
              Perdas
            </h3>
          </div>
          <CircularProgress
            value={displayMetricas.percentualPerdidos || 0}
            maxValue={100}
            color={(displayMetricas.percentualPerdidos || 0) > 1.0 ? '#F59E0B' : '#0891b2'}
            label={(displayMetricas.percentualPerdidos || 0).toFixed(1)}
            isPercentage={true}
          />
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-cyan-400 font-semibold group-hover:underline">
            <span>Ver falhas</span>
            <span className="text-[11px]">→</span>
          </div>
          <p className="text-[9px] text-light-text-muted">Meta: ≤ 1%</p>
        </div>

        {/* 5. Card Avaliação NPS */}
        <div className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-cyan-500/30 transition-colors">
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full mb-1">
              INDIVIDUAL
            </span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider">
              NPS
            </h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <p className="text-4xl font-bold text-cyan-400">{displayMetricas.npsScore?.toFixed(1) || '0.0'}</p>
            <p className="text-xs text-status-success font-medium mt-1">+{displayMetricas.pontosNps || 0} pts</p>
          </div>
          <p className="text-[10px] text-light-text-muted mt-1">Meta: ≥ 85</p>
        </div>

        {/* 6. Card Peças */}
        <div className="bg-light-surface dark:bg-surface rounded-positivo-lg p-4 border border-light-border dark:border-border shadow-sm flex flex-col items-center text-center justify-center hover:border-cyan-500/30 transition-colors">
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full mb-1">
              EQUIPE
            </span>
            <h3 className="text-xs font-bold text-light-text-secondary dark:text-text-main uppercase tracking-wider">
              Peças
            </h3>
          </div>
          <CircularProgress
            value={percentualConsumo}
            maxValue={100}
            color={percentualConsumo < 25.0 ? '#F59E0B' : '#0891b2'}
            label={percentualConsumo.toFixed(1)}
            isPercentage={true}
          />
          <p className="text-[10px] text-light-text-muted mt-1">Meta: ≥ 25%</p>
        </div>
      </div>

      {/* MODAL DE CHAMADOS REINCIDENTES COM ANÁLISE DE FALHAS */}
      <ModalChamadosReincidentes
        isOpen={isReincidentesModalOpen}
        onClose={() => setIsReincidentesModalOpen(false)}
        tecnicoId={displayMetricas.idTecnico || (displayMetricas as any).id || (user as any)?.idTecnico || (user as any)?.id}
        tecnicoNome={displayMetricas.tecnico || displayMetricas.nomeCompleto || user?.nomeCompleto}
        selectedMonth={selectedMonth}
        percentualReincidencia={percentualReincidencia}
        pontosReincidencia={displayMetricas.pontosReincidencia || 0}
      />

            {/* MODAL DE CHAMADOS PERDIDOS DE SLA E CAUSAS */}
      <ModalChamadosSlaPerdidos
        isOpen={isSlaModalOpen}
        onClose={() => setIsSlaModalOpen(false)}
        tecnicoId={displayMetricas.idTecnico || (displayMetricas as any).id || (user as any)?.idTecnico || (user as any)?.id}
        tecnicoNome={displayMetricas.tecnico || displayMetricas.nomeCompleto || user?.nomeCompleto}
        selectedMonth={selectedMonth}
        percentualSla={percentualSla}
        pontosSla={displayMetricas.pontosSla || 0}
      />

      {/* MODAL DE PERDAS (FALHAS DE GESTÃO & TRANSFERÊNCIA ENTRE BASES) */}
      <ModalChamadosPerdas
        isOpen={isPerdasModalOpen}
        onClose={() => setIsPerdasModalOpen(false)}
        tecnicoId={displayMetricas.idTecnico || (displayMetricas as any).id || (user as any)?.idTecnico || (user as any)?.id}
        tecnicoNome={displayMetricas.tecnico || displayMetricas.nomeCompleto || user?.nomeCompleto}
        selectedMonth={selectedMonth}
        percentualPerdidos={displayMetricas.percentualPerdidos || 0}
      />

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

function getPremioInfo(pontos: number) {
  if (pontos >= 90) return { titulo: '1º Prêmio', valor: 'R$ 300,00' };
  if (pontos >= 80) return { titulo: '2º Prêmio', valor: 'R$ 200,00' };
  if (pontos >= 70) return { titulo: '3º Prêmio', valor: 'R$ 100,00' };
  return null;
}
