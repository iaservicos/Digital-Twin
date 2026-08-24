import React from 'react';
import { Trophy, X } from 'lucide-react';

interface ModalElegivelProps {
  isOpen: boolean;
  onClose: () => void;
  premioAtual: { titulo: string; valor: string } | null;
  pontuacaoTotal: number;
}

export const ModalElegivel: React.FC<ModalElegivelProps> = ({
  isOpen,
  onClose,
  premioAtual,
  pontuacaoTotal
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-light-surface dark:bg-surface rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-accent-emerald/30 animate-in zoom-in-95 text-center relative p-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <X size={24} />
        </button>
        <div className="mx-auto bg-accent-emerald/10 w-24 h-24 rounded-full flex items-center justify-center mb-6">
          <Trophy size={48} className="text-accent-emerald" />
        </div>
        <h2 className="text-3xl font-black text-light-text-main dark:text-text-main mb-2">
          {premioAtual ? "Parabéns!" : "Quase lá!"}
        </h2>
        <p className="text-light-text-secondary dark:text-text-muted mb-6 text-lg">
          {premioAtual 
            ? "Você está elegível para a premiação neste período. Continue se empenhando para manter ou melhorar seus resultados!"
            : "Você manteve seus indicadores dentro da meta de elegibilidade, mas a sua pontuação total ainda não atingiu a faixa de premiação."}
        </p>
        
        <div className="bg-slate-50 dark:bg-surface/50 rounded-2xl p-6 border border-slate-100 dark:border-border/50">
          <p className="text-sm font-bold text-light-text-muted dark:text-text-muted uppercase tracking-widest mb-2">Prêmio Projetado</p>
          {premioAtual ? (
            <>
              <div className="text-xl font-bold text-accent-emerald">{premioAtual.titulo}</div>
              <div className="text-4xl font-black text-light-text-main dark:text-text-main mt-1">{premioAtual.valor}</div>
              <p className="text-xs text-light-text-muted dark:text-text-muted mt-3">* Baseado na sua pontuação de {pontuacaoTotal} pontos.</p>
            </>
          ) : (
            <>
              <div className="text-2xl font-black text-light-text-muted dark:text-text-muted mb-2">{pontuacaoTotal} pontos</div>
              <p className="text-sm font-medium text-light-text-main dark:text-text-muted leading-relaxed">
                Não desanime, sua pontuação pode melhorar! Lembre-se que a primeira faixa de premiação começa a partir de <strong>70 pontos</strong>.
              </p>
            </>
          )}
        </div>

        <button onClick={onClose} className="mt-8 w-full bg-accent-emerald hover:bg-emerald-600 text-white dark:text-[#0f172a] py-4 rounded-xl font-bold text-lg transition-colors shadow-lg shadow-accent-emerald/20">
          Incrível!
        </button>
      </div>
    </div>
  );
};
