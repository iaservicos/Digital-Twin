import React from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Award, Target, Zap } from 'lucide-react';

interface ModalExplicacaoSlaProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalExplicacaoSla: React.FC<ModalExplicacaoSlaProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 lg:left-64 z-30 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="glass-bento border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-light-text-main dark:text-text-main relative transition-colors animate-in zoom-in-95">
        
        {/* Top Header */}
        <div className="p-6 border-b border-light-border dark:border-border flex justify-between items-center bg-light-background/60 dark:bg-input-bg/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Target size={11} /> SLA Operacional
                </span>
                <span className="text-xs text-light-text-muted dark:text-text-muted font-medium">
                  • Peso: 33,5 pontos no Programa Brilha+
                </span>
              </div>
              <h2 className="text-xl font-bold text-light-text-main dark:text-text-main">
                O que é SLA & Regras de Pontuação
              </h2>
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

        {/* Modal Body with Scroll */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6 scrollbar-hide">
          
          {/* Seção 1: Conceito e Importância */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* O que é SLA */}
            <div className="p-4 rounded-xl bg-light-surface/60 dark:bg-surface-elevated/40 border border-light-border dark:border-border/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                  <Zap size={16} />
                  <span>O que é SLA?</span>
                </div>
                <p className="text-xs leading-relaxed text-light-text-secondary dark:text-text-muted">
                  <strong>SLA</strong> (<em>Service Level Agreement</em> ou Acordo de Nível de Serviço) é a métrica contratual que avalia a eficiência e o compromisso temporal de atendimento da nossa equipe. Ele representa a porcentagem de chamados atendidos e concluídos estritamente dentro do prazo estipulado pelos contratos Corporativos e Governamentais da Positivo.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-light-border dark:border-border/40 text-[11px] font-semibold text-primary">
                Fórmula: (Chamados Dentro do Prazo ÷ Total Atendido) × 100
              </div>
            </div>

            {/* Importância Operacional */}
            <div className="p-4 rounded-xl bg-light-surface/60 dark:bg-surface-elevated/40 border border-light-border dark:border-border/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm mb-2">
                  <Award size={16} />
                  <span>Qual a sua Importância?</span>
                </div>
                <p className="text-xs leading-relaxed text-light-text-secondary dark:text-text-muted">
                  O cumprimento do SLA garante a confiança e fidelização dos clientes, assegura a alta disponibilidade de equipamentos essenciais em campo e <strong>evita glosas e multas contratuais severas</strong> para a empresa. Uma equipe com SLA alto demonstra excelência operacional, agilidade e qualidade técnica superior.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-light-border dark:border-border/40 text-[11px] font-semibold text-emerald-500">
                Garante pontuação máxima de 33,5 pontos no Brilha+
              </div>
            </div>
          </div>

          {/* Seção 2: Tabela de Faixas de Pontuação Oficial */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-light-text-main dark:text-text-main uppercase tracking-wider flex items-center gap-2">
                <Target size={15} className="text-primary" />
                Faixas Oficiais de Pontuação (Meta: ≥ 90%)
              </h3>
              <span className="text-[11px] text-light-text-muted dark:text-text-muted font-medium">
                Indicador com maior peso na matriz de pontos
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-light-border dark:border-border">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-light-surface/80 dark:bg-surface-elevated/80 text-light-text-secondary dark:text-text-muted text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-3.5 border-b border-light-border dark:border-border">Faixa de SLA</th>
                    <th className="p-3.5 border-b border-light-border dark:border-border text-center">Pontuação</th>
                    <th className="p-3.5 border-b border-light-border dark:border-border text-center">Status</th>
                    <th className="p-3.5 border-b border-light-border dark:border-border">Descrição Operacional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-border/40 text-xs bg-light-surface/30 dark:bg-surface/30">
                  {/* Faixa 1: >= 100% */}
                  <tr className="hover:bg-light-background/60 dark:hover:bg-surface-elevated/50 transition-colors">
                    <td className="p-3.5 font-bold text-light-text-main dark:text-text-main">
                      <span className="text-sm text-emerald-500 font-black">≥ 100,0%</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black text-sm shadow-xs">
                        33,5 pts
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-bold">
                        <CheckCircle2 size={13} /> Superação
                      </span>
                    </td>
                    <td className="p-3.5 text-light-text-secondary dark:text-text-muted">
                      Pontuação máxima por excelência operacional e superação absoluta do prazo contratual em todos os chamados.
                    </td>
                  </tr>

                  {/* Faixa 2: 90% a 99.9% */}
                  <tr className="hover:bg-light-background/60 dark:hover:bg-surface-elevated/50 transition-colors">
                    <td className="p-3.5 font-bold text-light-text-main dark:text-text-main">
                      <span className="text-sm text-primary font-black">90,0% a 99,9%</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-block px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary font-black text-sm shadow-xs">
                        29,0 pts
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                        <CheckCircle2 size={13} /> Meta Atingida
                      </span>
                    </td>
                    <td className="p-3.5 text-light-text-secondary dark:text-text-muted">
                      Meta padrão da campanha atingida com sucesso, assegurando excelente nível de serviço aos clientes.
                    </td>
                  </tr>

                  {/* Faixa 3: < 90% */}
                  <tr className="hover:bg-light-background/60 dark:hover:bg-surface-elevated/50 transition-colors">
                    <td className="p-3.5 font-bold text-light-text-main dark:text-text-main">
                      <span className="text-sm text-rose-500 font-black">&lt; 90,0%</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-block px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-black text-sm shadow-xs">
                        0,0 pt
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[11px] font-bold">
                        <AlertTriangle size={13} /> Abaixo da Meta
                      </span>
                    </td>
                    <td className="p-3.5 text-light-text-secondary dark:text-text-muted">
                      Abaixo do gatilho regulamentar da equipe (≥ 90,0%). Nenhum ponto é pontuado neste KPI durante o ciclo.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção 3: Card de Destaque do Gatilho */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-light-text-secondary dark:text-text-muted leading-relaxed">
              <strong className="text-amber-600 dark:text-amber-400 font-bold block mb-0.5">
                Regra Importante do Gatilho de Equipe:
              </strong>
              Para pontuar no indicador de SLA, a base operacional da equipe deve atingir no mínimo <strong>90,0%</strong> de SLA no mês de apuração. Quando a equipe atinge o gatilho, a pontuação individual de cada colaborador é validada de acordo com as faixas contratuais.
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-light-background/60 dark:bg-input-bg/60 border-t border-light-border dark:border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-primary text-slate-950 font-bold hover:brightness-110 transition-all cursor-pointer shadow-xs"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
