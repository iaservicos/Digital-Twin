import React, { useState } from 'react';
import { Cpu, XCircle, CheckCircle2, AlertTriangle, Building2, User, Clock, FileText, ChevronRight } from 'lucide-react';

// Formata data ISO para 'DD/MM/AAAA HH:mm'
const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return 'Data não informada';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
  } catch {
    return dateStr;
  }
};

export const ChamadoItem = ({ item }: any) => {
  const [modalOpen, setModalOpen] = useState(false);

  // Mapeamento resiliente de dados (suporta novo backend e formato legado)
  const chamadoNumero = item.chamado || item.id || 'Sem número';
  const equipamento = item.equipamento || item.desc || 'Equipamento Positivo';
  const projeto = item.projeto || (item.equipamento?.includes('H3') ? 'Governo' : 'Corporativo');
  const rawStatus = (item.slaStatus || item.status || '').toUpperCase();
  const isLate = rawStatus === 'FORA' || rawStatus === 'FORA DO SLA' || item.isLate === true;
  const statusLabel = isLate ? 'Fora do SLA' : 'Dentro do SLA';
  const dataFormatada = formatDateTime(item.ft || item.time);
  const assistencia = item.assistenciaNome || item.ct || '';
  const tecnico = item.tecnicoNome || '';
  const textoEncerramento = item.textoEncerrado || item.textoEncerramento || '';
  const classifica = item.classificaChamado || item.causaPerda || '';

  return (
    <>
      <div 
        className="bg-light-background dark:bg-background/70 hover:bg-light-border/30 dark:hover:bg-surface-hover rounded-xl border border-light-border dark:border-border/70 relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer group"
        onClick={() => setModalOpen(true)}
      >
        {/* Barra lateral de status SLA */}
        <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-md ${isLate ? 'bg-rose-500' : 'bg-primary'}`} />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 pl-4 gap-2">
          {/* Informações Principais */}
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm text-light-text-main dark:text-text-main">
                #{chamadoNumero}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                projeto === 'Governo' 
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}>
                {projeto}
              </span>
              {assistencia && (
                <span className="text-[11px] text-light-text-muted dark:text-text-muted truncate flex items-center gap-1">
                  <Building2 size={12} className="shrink-0" />
                  {assistencia}
                </span>
              )}
            </div>

            <p className="text-xs text-light-text-secondary dark:text-text-main font-medium truncate mt-1">
              {equipamento}
            </p>

            {tecnico && (
              <p className="text-[11px] text-light-text-muted dark:text-text-muted truncate mt-0.5 flex items-center gap-1">
                <User size={11} className="shrink-0" />
                {tecnico}
              </p>
            )}
          </div>

          {/* Status e Data */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-light-borderStrong/40 dark:border-border/40">
            <div className="text-left sm:text-right">
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isLate 
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}>
                {isLate ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                {statusLabel}
              </span>
              <p className="text-[11px] font-mono text-light-text-muted dark:text-text-muted mt-1 flex items-center gap-1 sm:justify-end">
                <Clock size={11} className="shrink-0" />
                {dataFormatada}
              </p>
            </div>
            
            <ChevronRight size={16} className="text-light-text-muted dark:text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Chamado */}
      {modalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setModalOpen(false)}
        >
          <div 
            className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 flex justify-between items-center ${isLate ? 'bg-rose-600 text-white' : 'bg-primary text-black'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono font-black text-lg">#{chamadoNumero}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isLate ? 'bg-white/20 text-white' : 'bg-black/10 text-black'}`}>
                    {projeto}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 truncate max-w-xs ${isLate ? 'text-white/90' : 'text-black/80 font-medium'}`}>{equipamento}</p>
              </div>
              <button 
                onClick={() => setModalOpen(false)} 
                className={`p-1 rounded-lg transition-colors cursor-pointer ${isLate ? 'text-white hover:text-white/80' : 'text-black hover:text-black/70'}`}
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto scrollbar-hide max-h-[70vh]">
              <div className="grid grid-cols-2 gap-3 bg-light-background dark:bg-input-bg p-3 rounded-xl border border-light-borderStrong/60 dark:border-border">
                <div>
                  <p className="text-[10px] text-light-text-muted dark:text-text-muted font-bold uppercase tracking-wider">Status SLA</p>
                  <p className={`font-bold text-sm mt-0.5 ${isLate ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {statusLabel}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-light-text-muted dark:text-text-muted font-bold uppercase tracking-wider">Data de Encerramento (FT)</p>
                  <p className="font-bold text-sm mt-0.5 text-light-text-main dark:text-text-main">
                    {dataFormatada}
                  </p>
                </div>
              </div>

              {(tecnico || assistencia) && (
                <div className="grid grid-cols-2 gap-3">
                  {tecnico && (
                    <div className="bg-light-background dark:bg-input-bg p-3 rounded-xl border border-light-borderStrong/60 dark:border-border">
                      <p className="text-[10px] text-light-text-muted dark:text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">
                        <User size={12} /> Técnico Responsável
                      </p>
                      <p className="text-xs font-semibold text-light-text-main dark:text-text-main mt-1 truncate">
                        {tecnico}
                      </p>
                    </div>
                  )}
                  {assistencia && (
                    <div className="bg-light-background dark:bg-input-bg p-3 rounded-xl border border-light-borderStrong/60 dark:border-border">
                      <p className="text-[10px] text-light-text-muted dark:text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">
                        <Building2 size={12} /> Base / Assistência
                      </p>
                      <p className="text-xs font-semibold text-light-text-main dark:text-text-main mt-1 truncate">
                        {assistencia}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {classifica && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Classificação do Chamado</p>
                  <p className="text-xs font-semibold text-light-text-main dark:text-text-main mt-0.5">
                    {classifica}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-light-text-muted dark:text-text-muted mb-1.5 flex items-center gap-1">
                  <FileText size={12} /> Texto de Encerramento (FT)
                </p>
                <div className="bg-light-background dark:bg-input-bg rounded-xl border border-light-borderStrong/60 dark:border-border p-3.5">
                  <p className="text-xs text-light-text-secondary dark:text-text-muted leading-relaxed italic whitespace-pre-wrap">
                    {textoEncerramento ? `"${textoEncerramento}"` : 'Nenhum texto de encerramento registrado pelo técnico.'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-3 bg-light-background dark:bg-input-bg border-t border-light-borderStrong/60 dark:border-border flex justify-end">
              <button 
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-light-border/60 hover:bg-light-border/80 dark:bg-surface-elevated dark:hover:bg-surface-hover text-light-text-main dark:text-text-main border border-transparent dark:border-border/50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
