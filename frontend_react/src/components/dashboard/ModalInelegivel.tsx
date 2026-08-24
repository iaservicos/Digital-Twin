import React from 'react';
import { HeartHandshake, AlertCircle, X } from 'lucide-react';

interface ModalInelegivelProps {
  isOpen: boolean;
  onClose: () => void;
  motivoInelegibilidade: string;
}

export const ModalInelegivel: React.FC<ModalInelegivelProps> = ({
  isOpen,
  onClose,
  motivoInelegibilidade
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-light-surface dark:bg-surface rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-status-danger/30 animate-in zoom-in-95 text-center relative p-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <X size={24} />
        </button>
        <div className="mx-auto bg-status-danger/10 w-24 h-24 rounded-full flex items-center justify-center mb-6">
          <HeartHandshake size={48} className="text-status-danger" />
        </div>
        <h2 className="text-3xl font-black text-light-text-main dark:text-text-main mb-2">Não desanime!</h2>
        <p className="text-light-text-secondary dark:text-text-muted mb-6 text-lg">
          Infelizmente, você não atingiu a elegibilidade neste período. Mas o próximo mês é uma nova chance de brilhar!
        </p>
        
        <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-6 border border-red-100 dark:border-red-900/30">
          <p className="text-sm font-bold text-status-danger uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
            <AlertCircle size={16} /> Motivo
          </p>
          <div className="text-base font-medium text-light-text-main dark:text-slate-200">
            {motivoInelegibilidade || "Pontuação ou gatilho não atingido."}
          </div>
        </div>

        <button onClick={onClose} className="mt-8 w-full bg-slate-100 dark:bg-surface hover:bg-slate-200 dark:hover:bg-background text-light-text-main dark:text-text-main py-4 rounded-xl font-bold text-lg transition-colors shadow-lg">
          Vou melhorar!
        </button>
      </div>
    </div>
  );
};
