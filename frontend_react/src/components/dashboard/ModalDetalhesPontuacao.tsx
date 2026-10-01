import React from 'react';
import { Award, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';

interface ModalDetalhesPontuacaoProps {
  isOpen: boolean;
  onClose: () => void;
  metricas: any;
}

export const ModalDetalhesPontuacao: React.FC<ModalDetalhesPontuacaoProps> = ({
  isOpen,
  onClose,
  metricas
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 lg:left-64 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
      <div className="glass-bento border rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95">
        <div className="p-6 border-b border-light-border dark:border-border flex justify-between items-center bg-light-background/60 dark:bg-input-bg/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Award size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-light-text-main dark:text-text-main">
                Detalhamento da Pontuação Oficial
              </h2>
              <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">
                Valores oficiais calculados com base na matriz de 6 KPIs do programa Brilha+
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main transition-all cursor-pointer"
            title="Fechar Modal"
          >
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 overflow-x-auto overflow-y-auto max-h-[70vh] scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-light-surface/60 dark:bg-surface-elevated/60 text-light-text-secondary dark:text-text-muted text-xs font-bold uppercase tracking-wider">
                <th className="p-4 border-b border-light-border dark:border-border rounded-tl-xl">Mês</th>
                <th className="p-4 border-b border-light-border dark:border-border text-center" title="SLA Equipe (Máx 33,5 pts)">SLA Equipe</th>
                <th className="p-4 border-b border-light-border dark:border-border text-center" title="Perdas SLA Performance da Base (Máx 21,0 pts)">Perdas Equipe</th>
                <th className="p-4 border-b border-light-border dark:border-border text-center" title="Reincidência da Base (Máx 16,0 pts)">Reinc. Equipe</th>
                <th className="p-4 border-b border-light-border dark:border-border text-center" title="Reincidência Individual do Técnico (Máx 16,0 pts)">Reinc. Indiv.</th>
                <th className="p-4 border-b border-light-border dark:border-border text-center" title="Consumo de Peças Individual (Máx 13,5 pts)">Peças</th>
                <th className="p-4 border-b border-light-border dark:border-border text-center">Total</th>
                <th className="p-4 border-b border-light-border dark:border-border text-center rounded-tr-xl">Elegibilidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-border/40 bg-light-surface/40 dark:bg-surface/40">
              {metricas?.historico?.map((h: any, index: number) => {
                const isMedia = h.mes === 'Média Final';
                return (
                  <tr key={index} className={`hover:bg-light-background/80 dark:hover:bg-surface-elevated/80 transition-colors ${isMedia ? 'bg-light-background/90 dark:bg-input-bg font-semibold' : ''}`}>
                    {/* 1. Mês */}
                    <td className="p-4 font-bold text-light-text-main dark:text-text-main flex items-center gap-2">
                      {isMedia ? <TrendingUp size={16} className="text-primary"/> : null}
                      {h.mes}
                    </td>

                    {/* 2. SLA Equipe (Máx 33.5 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-text-main">{h.percentualSla?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosSla} pts</div>
                    </td>

                    {/* 3. Perdas Performance Equipe (Máx 21.0 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-text-main">{h.percentualPerdidos?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosPerdidos} pts</div>
                    </td>

                    {/* 4. Reincidência Equipe (Máx 16.0 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-text-main">{h.percentualReincidenciaEquipe?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosReincidenciaEquipe} pts</div>
                    </td>

                    {/* 5. Reincidência Individual (Máx 16.0 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-text-main">{h.percentualReincidencia?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosReincidencia} pts</div>
                    </td>

                    {/* 6. Consumo de Peças Individual (Máx 13.5 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-text-main">{h.percentualEficienciaPecas?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosPecas} pts</div>
                    </td>

                    {/* 8. Pontuação Total (com suporte a decimais .5) */}
                    <td className="p-4 text-center">
                      <div className="text-2xl font-black text-light-text-main dark:text-text-main">
                        {typeof h.pontosTotal === 'number' ? (h.pontosTotal % 1 !== 0 ? h.pontosTotal.toFixed(1) : h.pontosTotal) : h.pontosTotal}
                      </div>
                      <div className="text-[10px] text-light-text-muted dark:text-text-muted font-bold uppercase tracking-widest mt-0.5">Pontos</div>
                    </td>

                    {/* 9. Status Elegibilidade */}
                    <td className="p-4 text-center">
                      {h.elegivel ? (
                        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow-xs">
                          <CheckCircle2 size={14}/> Elegível
                        </span>
                      ) : (
                        <span className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow-xs" title={h.motivoInelegibilidade}>
                          <XCircle size={14}/> Inelegível
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-light-background/60 dark:bg-input-bg/60 border-t border-light-border dark:border-border flex justify-end">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl bg-light-buttonBg dark:bg-buttonBg border border-light-border dark:border-white/10 text-light-text-muted dark:text-text-muted hover:border-light-borderStrong dark:hover:border-white/20 hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover hover:text-light-text-main dark:hover:text-text-main font-semibold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
