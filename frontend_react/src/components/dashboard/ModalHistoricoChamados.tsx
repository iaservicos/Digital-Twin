import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  X, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  User, 
  Clock, 
  Search,
  ArrowLeft,
  Layers,
  Wrench
} from 'lucide-react';
import { api } from '../../services/api';

interface ModalHistoricoChamadosProps {
  isOpen: boolean;
  onClose: () => void;
  tecnicoId: number;
  initialDate?: string;
}

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

export const ModalHistoricoChamados: React.FC<ModalHistoricoChamadosProps> = ({
  isOpen,
  onClose,
  tecnicoId,
  initialDate = ''
}) => {
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [dataFiltro, setDataFiltro] = useState(initialDate);
  const [selectedChamado, setSelectedChamado] = useState<any | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  const fetchChamados = useCallback(async (pageNumber: number, filterDate?: string) => {
    if (tecnicoId === undefined || tecnicoId === null) return;

    try {
      setLoading(true);
      const params: any = { page: pageNumber, size: 8 };
      
      const activeDate = filterDate !== undefined ? filterDate : dataFiltro;
      if (activeDate) {
        params.data = activeDate;
        params.dataInicio = activeDate;
        params.dataFim = activeDate;
      }
      
      const response = await api.get(`/dashboard/tecnico/${tecnicoId}/chamados`, { params });
      if (response.data) {
        const items = response.data.content || [];
        setChamados(items);
        setTotalPages(response.data.totalPages || 0);
        setTotalElements(response.data.totalElements || 0);
        
        // Auto-seleciona o primeiro chamado da página caso nenhum esteja selecionado
        if (items.length > 0 && !selectedChamado) {
          setSelectedChamado(items[0]);
        } else if (items.length > 0 && selectedChamado) {
          // Atualiza o selecionado se ainda estiver na lista
          const found = items.find((c: any) => c.chamado === selectedChamado.chamado);
          if (found) setSelectedChamado(found);
          else setSelectedChamado(items[0]);
        } else {
          setSelectedChamado(null);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar chamados:', error);
    } finally {
      setLoading(false);
    }
  }, [tecnicoId, dataFiltro, selectedChamado]);

  useEffect(() => {
    if (isOpen && tecnicoId !== undefined && tecnicoId !== null) {
      const dateToUse = initialDate || '';
      setDataFiltro(dateToUse);
      fetchChamados(0, dateToUse);
      setPage(0);
      setIsMobileDetailOpen(false);
    }
  }, [isOpen, tecnicoId, initialDate]);

  if (!isOpen) return null;

  const handlePesquisar = () => {
    fetchChamados(0);
    setPage(0);
  };

  const handleLimparFiltro = () => {
    setDataFiltro('');
    fetchChamados(0, '');
    setPage(0);
  };

  const handlePrevious = () => {
    if (page > 0) {
      setPage(page - 1);
      fetchChamados(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages - 1) {
      setPage(page + 1);
      fetchChamados(page + 1);
    }
  };

  const handleSelectChamado = (item: any) => {
    setSelectedChamado(item);
    setIsMobileDetailOpen(true);
  };

  return (
    <div className="fixed inset-0 lg:left-64 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass-bento border rounded-2xl w-full max-w-5xl h-[88vh] max-h-[88vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        
        {/* HEADER DO MODAL */}
        <div className="p-4 sm:p-5 border-b border-light-border dark:border-border bg-light-background/80 dark:bg-input-bg/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-light-text-main dark:text-text-main tracking-tight">
                  Histórico & Auditoria de Chamados
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {totalElements} {totalElements === 1 ? 'chamado' : 'chamados'}
                </span>
              </div>
              <p className="text-xs text-light-text-muted dark:text-text-muted hidden sm:block">
                Registro operacional auditado diretamente da base Databricks
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-light-text-muted hover:text-light-text-main dark:text-text-muted dark:hover:text-text-main hover:bg-light-buttonBgHover dark:hover:bg-buttonBgHover rounded-xl transition-colors cursor-pointer"
            title="Fechar Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* BARRA DE FILTRO POR DATA */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-light-border/80 dark:border-border/80 bg-light-surface/60 dark:bg-surface-elevated/40 flex items-center justify-between gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 text-xs">
            <Calendar size={14} className="text-primary shrink-0" />
            <span className="text-light-text-muted dark:text-text-muted font-medium">Filtrar por data:</span>
            <input 
              type="date" 
              value={dataFiltro}
              onChange={(e) => setDataFiltro(e.target.value)}
              className="bg-light-background dark:bg-input-bg border border-light-border dark:border-border text-light-text-main dark:text-text-main text-xs px-2.5 py-1 rounded-lg focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            />
            <button 
              onClick={handlePesquisar}
              className="bg-primary text-black px-3 py-1 rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Filtrar
            </button>
            {dataFiltro && (
              <button 
                onClick={handleLimparFiltro}
                className="text-xs text-light-text-muted hover:text-light-text-main dark:text-text-muted dark:hover:text-text-main px-2 py-1 transition-colors cursor-pointer underline"
              >
                Ver todos os dias
              </button>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs ml-auto">
              <button 
                onClick={handlePrevious} 
                disabled={page === 0}
                className="p-1 rounded-md text-light-text-main dark:text-text-main disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/10 transition-colors cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-light-text-muted dark:text-text-muted font-mono text-[11px]">
                {page + 1} / {totalPages}
              </span>
              <button 
                onClick={handleNext} 
                disabled={page >= totalPages - 1}
                className="p-1 rounded-md text-light-text-main dark:text-text-main disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/10 transition-colors cursor-pointer"
                title="Próxima Página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* CORPO MASTER-DETAIL: LISTA À ESQUERDA + DETALHES À DIREITA */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-light-border dark:divide-border">
          
          {/* PAINEL ESQUERDO: LISTA DE CHAMADOS */}
          <div className={`w-full md:w-5/12 flex flex-col h-full overflow-hidden ${isMobileDetailOpen ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 scrollbar-thin">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="text-xs text-light-text-muted dark:text-text-muted">Carregando chamados...</span>
                </div>
              ) : chamados.length > 0 ? (
                chamados.map((item: any, idx: number) => {
                  const numChamado = item.chamado || item.id || idx;
                  const isSelected = selectedChamado?.chamado === item.chamado;
                  const rawStatus = (item.slaStatus || item.status || '').toUpperCase();
                  const isLate = rawStatus === 'FORA' || rawStatus === 'FORA DO SLA' || item.isLate === true;
                  const proj = item.projeto || (item.equipamento?.includes('H3') ? 'Governo' : 'Corporativo');

                  return (
                    <div
                      key={numChamado}
                      onClick={() => handleSelectChamado(item)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer select-none text-left relative overflow-hidden ${
                        isSelected 
                          ? 'bg-primary/10 border-primary dark:border-primary shadow-sm' 
                          : 'bg-light-surface dark:bg-surface-elevated/40 border-light-border dark:border-border hover:border-primary/40 hover:bg-light-surface-elevated dark:hover:bg-surface-elevated'
                      }`}
                    >
                      {/* Borda indicativa SLA */}
                      <div className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r ${isLate ? 'bg-rose-500' : 'bg-emerald-500'}`} />

                      <div className="pl-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-light-text-main dark:text-text-main">
                              #{numChamado}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              proj.includes('GOV') || proj === 'Governo' 
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}>
                              {proj}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isLate 
                              ? 'bg-rose-500/10 text-rose-500' 
                              : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {isLate ? 'Fora SLA' : 'No Prazo'}
                          </span>
                        </div>

                        <p className="text-xs text-light-text-secondary dark:text-text-main font-medium truncate mt-1">
                          {item.equipamento || 'Equipamento Positivo'}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-light-text-muted dark:text-text-muted mt-1 font-mono">
                          <span>{item.assistenciaNome || item.ct || 'Base Regional'}</span>
                          <span>{formatDateTime(item.ft)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-light-text-muted dark:text-text-muted py-16 text-xs">
                  Nenhum chamado encontrado para a data selecionada.
                </div>
              )}
            </div>
          </div>

          {/* PAINEL DIREITO: DETALHES COMPLETOS DO CHAMADO SELECIONADO */}
          <div className={`w-full md:w-7/12 flex-col h-full overflow-hidden bg-light-background/40 dark:bg-background/40 ${isMobileDetailOpen ? 'flex' : 'hidden md:flex'}`}>
            {selectedChamado ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                
                {/* Botão voltar no Mobile */}
                <div className="md:hidden p-3 border-b border-light-border dark:border-border bg-light-surface dark:bg-surface flex items-center gap-2">
                  <button
                    onClick={() => setIsMobileDetailOpen(false)}
                    className="flex items-center gap-1 text-xs text-primary font-bold cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    Voltar para lista de chamados
                  </button>
                </div>

                {/* Header do Chamado Selecionado */}
                <div className="p-4 sm:p-5 border-b border-light-border dark:border-border bg-light-surface/60 dark:bg-surface-elevated/40">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-lg sm:text-xl text-light-text-main dark:text-text-main">
                        #{selectedChamado.chamado}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase">
                        {selectedChamado.projeto || 'Corporativo'}
                      </span>
                    </div>

                    {/* Badge de Status SLA */}
                    {(() => {
                      const rawSla = (selectedChamado.slaStatus || '').toUpperCase();
                      const isLate = rawSla === 'FORA' || rawSla === 'FORA DO SLA';
                      return (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                          isLate 
                            ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' 
                            : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                        }`}>
                          {isLate ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                          {isLate ? 'FORA DO SLA' : 'DENTRO DO SLA'}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-light-text-muted dark:text-text-muted mt-1 font-medium">
                    {selectedChamado.equipamento || 'Equipamento Positivo'}
                  </p>
                </div>

                {/* Conteúdo Auditado do Chamado */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin">
                  
                  {/* Grid de Informações Chave */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-light-surface dark:bg-surface-elevated/60 border border-light-border dark:border-border p-3.5 rounded-xl">
                      <span className="text-[10px] text-light-text-muted dark:text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock size={12} className="text-primary" /> Data de Encerramento (FT)
                      </span>
                      <p className="font-mono font-bold text-xs sm:text-sm text-light-text-main dark:text-text-main mt-1">
                        {formatDateTime(selectedChamado.ft)}
                      </p>
                    </div>

                    <div className="bg-light-surface dark:bg-surface-elevated/60 border border-light-border dark:border-border p-3.5 rounded-xl">
                      <span className="text-[10px] text-light-text-muted dark:text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">
                        <Building2 size={12} className="text-primary" /> Base / Assistência
                      </span>
                      <p className="font-semibold text-xs sm:text-sm text-light-text-main dark:text-text-main mt-1 truncate">
                        {selectedChamado.assistenciaNome || selectedChamado.ct || 'Base Regional'}
                      </p>
                    </div>

                    <div className="bg-light-surface dark:bg-surface-elevated/60 border border-light-border dark:border-border p-3.5 rounded-xl sm:col-span-2">
                      <span className="text-[10px] text-light-text-muted dark:text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">
                        <User size={12} className="text-primary" /> Técnico Responsável
                      </span>
                      <p className="font-semibold text-xs sm:text-sm text-light-text-main dark:text-text-main mt-1 truncate">
                        {selectedChamado.tecnicoNome || 'Técnico de Campo'}
                      </p>
                    </div>
                  </div>

                  {/* Classificação do Chamado */}
                  {selectedChamado.classificaChamado && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider block">
                        Classificação do Chamado
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-light-text-main dark:text-text-main mt-0.5">
                        {selectedChamado.classificaChamado}
                      </p>
                    </div>
                  )}

                  {/* Texto de Encerramento (FT) Auditado */}
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-light-text-muted dark:text-text-muted mb-1.5 flex items-center gap-1">
                      <FileText size={12} className="text-primary" /> Texto de Encerramento (FT)
                    </span>
                    <div className="bg-light-surface dark:bg-surface-elevated/60 rounded-xl border border-light-border dark:border-border p-4 shadow-inner">
                      <p className="text-xs text-light-text-secondary dark:text-text-muted leading-relaxed italic whitespace-pre-wrap">
                        {selectedChamado.textoEncerrado 
                          ? `"${selectedChamado.textoEncerrado}"` 
                          : 'Nenhum texto de encerramento registrado pelo técnico.'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-light-text-muted dark:text-text-muted">
                <FileText size={36} className="text-primary/40 mb-2" />
                <p className="text-sm font-semibold text-light-text-main dark:text-text-main">Nenhum chamado selecionado</p>
                <p className="text-xs mt-1">Selecione um chamado na lista à esquerda para auditar os detalhes operacionais.</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
