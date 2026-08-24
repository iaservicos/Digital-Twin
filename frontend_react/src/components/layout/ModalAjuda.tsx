import React from 'react';
import { X, HelpCircle, Award, Target, Info } from 'lucide-react';

interface ModalAjudaProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalAjuda({ isOpen, onClose }: ModalAjudaProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-light-surface dark:bg-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-light-borderStrong dark:border-border animate-in zoom-in-95 relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-light-borderStrong dark:border-border flex justify-between items-center bg-light-background dark:bg-background/50">
          <h2 className="text-2xl font-black text-light-text-main dark:text-text-main flex items-center gap-2">
            <HelpCircle className="text-accent-teal" size={28} /> Central de Ajuda
          </h2>
          <button onClick={onClose} className="text-light-text-muted hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto scrollbar-hide space-y-6">
          
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-light-text-main dark:text-text-main mb-2">Bem-vindo ao Brilha+! 🌟</h3>
            <p className="text-light-text-secondary dark:text-text-muted">
              O Brilha+ é o seu programa de performance. Aqui você acompanha em tempo real 
              os seus indicadores e descobre como alcançar a premiação máxima do mês.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card SLA */}
            <div className="bg-slate-50 dark:bg-background/50 p-5 rounded-2xl border border-slate-100 dark:border-border/50 hover:border-accent-teal/30 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Target className="text-accent-teal" size={20} />
                <h4 className="font-bold text-light-text-main dark:text-text-main">SLA (Equipe)</h4>
              </div>
              <p className="text-sm text-light-text-secondary dark:text-text-muted">
                Mede o tempo de atendimento da sua equipe. A meta é manter o SLA On-site <strong>acima de 90%</strong>. 
                Cada meta batida garante pontos cruciais para a elegibilidade.
              </p>
            </div>

            {/* Card Reincidência */}
            <div className="bg-slate-50 dark:bg-background/50 p-5 rounded-2xl border border-slate-100 dark:border-border/50 hover:border-status-danger/30 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Info className="text-status-danger" size={20} />
                <h4 className="font-bold text-light-text-main dark:text-text-main">Reincidência</h4>
              </div>
              <p className="text-sm text-light-text-secondary dark:text-text-muted">
                Evite que o mesmo equipamento volte a dar defeito. Tanto a reincidência da <strong>Equipe</strong> quanto a <strong>Individual</strong> devem estar <strong>abaixo de 7%</strong>.
              </p>
            </div>

            {/* Card Peças */}
            <div className="bg-slate-50 dark:bg-background/50 p-5 rounded-2xl border border-slate-100 dark:border-border/50 hover:border-cyan-400/30 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Award className="text-cyan-500" size={20} />
                <h4 className="font-bold text-light-text-main dark:text-text-main">Uso de Peças</h4>
              </div>
              <p className="text-sm text-light-text-secondary dark:text-text-muted">
                A eficiência no uso de peças reflete o diagnóstico assertivo. A meta individual é consumir peças em <strong>no máximo 25%</strong> dos atendimentos.
              </p>
            </div>

            {/* Card Elegibilidade */}
            <div className="bg-slate-50 dark:bg-background/50 p-5 rounded-2xl border border-slate-100 dark:border-border/50 hover:border-accent-emerald/30 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Award className="text-accent-emerald" size={20} />
                <h4 className="font-bold text-light-text-main dark:text-text-main">Premiação</h4>
              </div>
              <p className="text-sm text-light-text-secondary dark:text-text-muted">
                Acumule pontos em cada indicador! A partir de <strong>70 pontos totais</strong> você já entra na primeira faixa de premiação. 90+ garante o prêmio máximo!
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-light-borderStrong dark:border-border bg-light-background dark:bg-background/50 text-center">
          <button onClick={onClose} className="w-full md:w-auto px-8 py-3 bg-accent-teal hover:bg-primary-light text-[#0f172a] font-bold rounded-xl transition-all shadow-md">
            Entendido, vamos brilhar!
          </button>
        </div>

      </div>
    </div>
  );
}
