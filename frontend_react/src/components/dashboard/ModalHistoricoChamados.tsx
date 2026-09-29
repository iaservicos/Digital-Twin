import React from 'react';
import { FileText, XCircle } from 'lucide-react';
import ChamadosHistoryCard from './ChamadosHistoryCard';

interface ModalHistoricoChamadosProps {
  isOpen: boolean;
  onClose: () => void;
  tecnicoId: number;
  initialDate?: string;
}

export const ModalHistoricoChamados: React.FC<ModalHistoricoChamadosProps> = ({
  isOpen,
  onClose,
  tecnicoId,
  initialDate
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-light-surface dark:bg-surface rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-light-borderStrong dark:border-border animate-in zoom-in-95">
        <div className="p-5 border-b border-light-borderStrong dark:border-border/60 flex justify-between items-center bg-light-background dark:bg-input-bg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-light-text-main dark:text-text-main">
                Histórico & Auditoria de Chamados
              </h2>
              <p className="text-xs text-light-text-muted dark:text-text-muted">
                Registro operacional auditado diretamente da base Databricks
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-light-text-muted dark:text-text-muted hover:text-light-text-main dark:hover:text-text-main p-2 rounded-lg hover:bg-light-surface-elevated dark:hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <XCircle size={22} />
          </button>
        </div>

        <div className="p-6">
          <ChamadosHistoryCard tecnicoId={tecnicoId} initialDate={initialDate} />
        </div>
      </div>
    </div>
  );
};
