import React, { useState } from 'react';
import { Cpu, XCircle } from 'lucide-react';

export const ChamadoItem = ({ item }: any) => {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <div 
        className="bg-light-background dark:bg-background/50 rounded-lg border border-light-border dark:border-border/50 relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-md cursor-pointer"
        onClick={() => setModalOpen(true)}
      >
        <div className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r-md ${item.isLate ? 'bg-status-danger' : 'bg-accent-teal'}`}></div>
        
        <div className="flex justify-between items-center p-4">
          <div className="pl-4">
            <p className="font-bold text-sm text-light-text-main dark:text-text-main">{item.id}</p>
            <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">{item.desc}</p>
          </div>
          <div className="text-right flex items-center space-x-3">
            <div>
              <p className={`font-bold text-sm ${item.isLate ? 'text-status-danger' : 'text-accent-teal'}`}>
                {item.status}
              </p>
              <p className="text-xs text-light-text-muted dark:text-text-muted mt-0.5">{item.time}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setModalOpen(false)}>
          {/* Modal Content */}
          <div 
            className="bg-light-surface dark:bg-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 flex justify-between items-center text-text-main ${item.isLate ? 'bg-status-danger' : 'bg-accent-teal'}`}>
              <div>
                <h3 className="font-bold text-lg">{item.id}</h3>
                <p className="text-xs opacity-90">{item.desc}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-text-main hover:text-text-main/80 transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] scrollbar-hide">
              <div className="flex justify-between items-center border-b border-light-border dark:border-border pb-4">
                <div>
                  <p className="text-xs text-light-text-muted dark:text-text-muted font-medium uppercase tracking-wider">Status SLA</p>
                  <p className={`font-bold mt-1 ${item.isLate ? 'text-status-danger' : 'text-accent-teal'}`}>{item.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-light-text-muted dark:text-text-muted font-medium uppercase tracking-wider">Fechamento</p>
                  <p className="font-bold mt-1 text-light-text-secondary dark:text-text-main">{item.time}</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-light-text-muted mb-2 flex items-center"><Cpu size={14} className="mr-1.5"/> Peças Utilizadas</p>
                <div className="bg-light-background dark:bg-background rounded-lg border border-light-border dark:border-border p-3">
                  <p className="text-sm font-medium text-light-text-secondary dark:text-text-main">
                    {item.pecasUtilizadas || 'Nenhuma peça consumida'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-light-text-muted mb-2">Texto de Encerramento</p>
                <div className="bg-slate-100 dark:bg-background rounded-lg border border-light-borderStrong dark:border-border/80 p-4">
                  <p className="text-sm text-light-text-secondary dark:text-text-muted leading-relaxed italic">
                    "{item.textoEncerramento || 'Sem texto de encerramento'}"
                  </p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-light-background dark:bg-background border-t border-light-border dark:border-border flex justify-end">
              <button 
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-surface dark:hover:bg-slate-700 text-light-text-secondary dark:text-text-main rounded-lg text-sm font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
