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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-light-surface dark:bg-[#1e293b] rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-light-borderStrong dark:border-border animate-in zoom-in-95">
        <div className="p-6 border-b border-light-borderStrong dark:border-border flex justify-between items-center bg-light-background dark:bg-[#162032]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-teal/10 border border-accent-teal/20 flex items-center justify-center text-accent-teal">
              <Award size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-light-text-main dark:text-slate-100">
                Detalhamento da Pontuação Oficial
              </h2>
              <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">
                Valores oficiais calculados com base na matriz de 6 KPIs do programa Brilha+
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <XCircle size={22} />
          </button>
        </div>

        <div className="p-6 overflow-x-auto overflow-y-auto max-h-[70vh] scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-[#0f172a] text-slate-600 dark:text-text-muted text-xs font-bold uppercase tracking-wider">
                <th className="p-4 border-b border-light-borderStrong dark:border-border/60 rounded-tl-xl">Mês</th>
                <th className="p-4 border-b border-light-borderStrong dark:border-border/60 text-center" title="SLA Equipe (Máx 32,5 pts)">SLA Equipe</th>
                <th className="p-4 border-b border-light-borderStrong dark:border-border/60 text-center" title="Perdas SLA Performance da Base (Máx 20,0 pts)">Perdas Equipe</th>
                <th className="p-4 border-b border-light-borderStrong dark:border-border/60 text-center" title="NPS da Equipe (Máx 5,0 pts)">NPS Equipe</th>
                <th className="p-4 border-b border-light-borderStrong dark:border-border/60 text-center" title="Reincidência da Base (Máx 15,0 pts)">Reinc. Equipe</th>
                <th className="p-4 border-b border-light-borderStrong dark:border-border/60 text-center" title="Reincidência Individual do Técnico (Máx 15,0 pts)">Reinc. Indiv.</th>
                <th className="p-4 border-b border-light-borderStrong dark:border-border/60 text-center" title="Consumo de Peças Individual (Máx 12,5 pts)">Peças</th>
                <th className="p-4 border-b border-light-borderStrong dark:border-border/60 text-center">Total</th>
                <th className="p-4 border-b border-light-borderStrong dark:border-border/60 text-center rounded-tr-xl">Elegibilidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-border/40 bg-light-surface dark:bg-[#1e293b]">
              {metricas?.historico?.map((h: any, index: number) => {
                const isMedia = h.mes === 'Média Final';
                return (
                  <tr key={index} className={`hover:bg-light-background dark:hover:bg-slate-800/50 transition-colors ${isMedia ? 'bg-light-background dark:bg-slate-900/40 font-semibold' : ''}`}>
                    {/* 1. Mês */}
                    <td className="p-4 font-bold text-light-text-main dark:text-slate-200 flex items-center gap-2">
                      {isMedia ? <TrendingUp size={16} className="text-accent-teal"/> : null}
                      {h.mes}
                    </td>

                    {/* 2. SLA Equipe (Máx 32.5 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-slate-200">{h.percentualSla?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-accent-teal bg-accent-teal/10 border border-accent-teal/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosSla} pts</div>
                    </td>

                    {/* 3. Perdas Performance Equipe (Máx 20.0 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-slate-200">{h.percentualPerdidos?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosPerdidos} pts</div>
                    </td>

                    {/* 4. NPS Equipe (Máx 5.0 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-slate-200">{h.npsScore?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosNps} pts</div>
                    </td>

                    {/* 5. Reincidência Equipe (Máx 15.0 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-slate-200">{h.percentualReincidenciaEquipe?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosReincidenciaEquipe} pts</div>
                    </td>

                    {/* 6. Reincidência Individual (Máx 15.0 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-slate-200">{h.percentualReincidencia?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosReincidencia} pts</div>
                    </td>

                    {/* 7. Consumo de Peças Individual (Máx 12.5 pts) */}
                    <td className="p-4 text-center">
                      <div className="font-bold text-light-text-secondary dark:text-slate-200">{h.percentualEficienciaPecas?.toFixed(2)}%</div>
                      <div className="text-xs font-medium text-accent-teal bg-accent-teal/10 border border-accent-teal/20 px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap">{h.pontosPecas} pts</div>
                    </td>

                    {/* 8. Pontuação Total (com suporte a decimais .5) */}
                    <td className="p-4 text-center">
                      <div className="text-2xl font-black text-light-text-main dark:text-white">
                        {typeof h.pontosTotal === 'number' ? (h.pontosTotal % 1 !== 0 ? h.pontosTotal.toFixed(1) : h.pontosTotal) : h.pontosTotal}
                      </div>
                      <div className="text-[10px] text-light-text-muted dark:text-text-muted font-bold uppercase tracking-widest mt-0.5">Pontos</div>
                    </td>

                    {/* 9. Status Elegibilidade */}
                    <td className="p-4 text-center">
                      {h.elegivel ? (
                        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow-sm">
                          <CheckCircle2 size={14}/> Elegível
                        </span>
                      ) : (
                        <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow-sm" title={h.motivoInelegibilidade}>
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

        <div className="p-4 bg-light-background dark:bg-[#162032] border-t border-light-borderStrong dark:border-border flex justify-end">
          <button 
            onClick={onClose} 
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-2.5 rounded-xl font-bold transition-colors shadow-sm focus:outline-none"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
