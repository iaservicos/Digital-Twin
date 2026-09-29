import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Cpu, 
  Package, 
  Layers, 
  Calendar, 
  User, 
  Building2, 
  CheckCircle2, 
  Filter, 
  Clock,
  Wrench,
  FileText
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export interface PecaAplicadaDTO {
  chamado: string;
  ft: string;
  tipoEquipamento: string;
  acao: string;
  codSolicDesc: string;
  codAplicDesc: string;
  subgrupo?: string;
  grupoMercadoria: string;
  grupoMercadoriaDesc: string;
  tecnicoNome: string;
  projeto: string;
  assistenciaCidade: string;
  ocorrenciaChamado: string;
  textoEncerrado: string;
}

interface ModalChamadosPecasProps {
  isOpen: boolean;
  onClose: () => void;
  tecnicoId?: number | null;
  tecnicoNome?: string;
  selectedMonth?: string;
  percentualConsumo?: number;
  pontosPecas?: number;
}

// Helper de formatação de data e hora no padrão 'DD/MM/AAAA HH:mm'
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

// Helper de formatação de mês/ano
const formatMesAno = (mesAnoStr?: string | null): string => {
  if (!mesAnoStr) return 'Campanha Completa';
  const str = mesAnoStr.trim();
  if (str === '2026-07' || str.toLowerCase().includes('jul')) return 'Julho / 2026';
  if (str === '2026-08' || str.toLowerCase().includes('ago')) return 'Agosto / 2026';
  if (str === '2026-09' || str.toLowerCase().includes('set')) return 'Setembro / 2026';
  return str;
};

// Helper de segmentação por grupo de peça elegível da campanha
const categorizarPeca = (item: PecaAplicadaDTO): string => {
  const sub = (item.subgrupo || '').toUpperCase();
  const desc = (item.codAplicDesc || item.codSolicDesc || '').toUpperCase();
  const grupo = (item.grupoMercadoriaDesc || '').toUpperCase();

  if (sub.includes('LCD') || sub.includes('TELA') || desc.includes('LCD') || desc.includes('TELA') || grupo.includes('LCD') || grupo.includes('TELA')) return 'TELA';
  if (sub.includes('SSD') || desc.includes('SSD') || grupo.includes('SSD')) return 'SSD';
  if (sub.includes('HD') || desc.includes('HD') || desc.includes('HARD DISK') || grupo.includes('HARD DISK')) return 'HD';
  if (sub.includes('PLACA') || sub.includes('PLM') || desc.includes('PLM') || desc.includes('PLACA') || grupo.includes('PLACA')) return 'PLM';
  return 'OUTROS';
};

export default function ModalChamadosPecas({
  isOpen,
  onClose,
  tecnicoId,
  tecnicoNome = 'Técnico',
  selectedMonth,
  percentualConsumo = 0,
  pontosPecas = 12.5
}: ModalChamadosPecasProps) {
  const user = useAuthStore(state => state.user);
  const role = (user?.role || '').toUpperCase();
  const isSupervisorOrAdmin = ['SUPERVISOR', 'MODERADOR', 'ADMIN', 'ROLE_SUPERVISOR', 'ROLE_MODERADOR', 'ROLE_ADMIN'].includes(role);

  const [pecas, setPecas] = useState<PecaAplicadaDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<'TODAS' | 'TELA' | 'SSD' | 'HD' | 'PLM'>('TODAS');

  const targetId = tecnicoId || (user as any)?.idTecnico || (user as any)?.id || (user as any)?.tecnicoId;

  useEffect(() => {
    if (!isOpen) return;

    const fetchPecas = async () => {
      try {
        setLoading(true);
        const params: Record<string, string> = {};
        if (selectedMonth && selectedMonth !== 'Campanha Inteira' && selectedMonth !== 'Média Final') {
          params.mesAno = selectedMonth;
        }

        const idParaBuscar = targetId || 0;
        const res = await api.get(`/dashboard/tecnico/${idParaBuscar}/pecas`, { params });
        if (Array.isArray(res.data)) {
          setPecas(res.data);
        } else {
          setPecas([]);
        }
      } catch (err) {
        console.error('Erro ao buscar detalhamento de peças aplicadas:', err);
        setPecas([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPecas();
  }, [isOpen, targetId, selectedMonth]);

  // Contadores por categoria elegível
  const contadores = useMemo(() => {
    const counts = { TODAS: pecas.length, TELA: 0, SSD: 0, HD: 0, PLM: 0 };
    pecas.forEach(p => {
      const cat = categorizarPeca(p);
      if (cat in counts) {
        counts[cat as keyof typeof counts]++;
      }
    });
    return counts;
  }, [pecas]);

  // Total de chamados únicos com aplicação de peça
  const totalChamadosUnicos = useMemo(() => {
    return new Set(pecas.map(p => p.chamado)).size;
  }, [pecas]);

  // Filtragem
  const filteredPecas = useMemo(() => {
    return pecas.filter(item => {
      const matchSearch =
        (item.chamado && item.chamado.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.subgrupo && item.subgrupo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.codAplicDesc && item.codAplicDesc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.codSolicDesc && item.codSolicDesc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.tecnicoNome && item.tecnicoNome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.grupoMercadoriaDesc && item.grupoMercadoriaDesc.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.acao && item.acao.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.projeto && item.projeto.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.textoEncerrado && item.textoEncerrado.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (categoriaFiltro === 'TODAS') return true;
      return categorizarPeca(item) === categoriaFiltro;
    });
  }, [pecas, searchTerm, categoriaFiltro]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-light-surface dark:bg-surface border border-light-borderStrong dark:border-border rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        
        {/* HEADER DO MODAL */}
        <div className="p-6 border-b border-light-borderStrong dark:border-border/60 bg-light-background dark:bg-input-bg flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 border border-primary/20 text-primary rounded-xl">
              <Cpu size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
                  {isSupervisorOrAdmin && !tecnicoNome ? 'VISÃO GERENCIAL' : 'KPI INDIVIDUAL'}
                </span>
                <span className="text-[11px] font-semibold text-light-text-muted dark:text-text-muted">
                  • {formatMesAno(selectedMonth)}
                </span>
                {tecnicoNome && (
                  <span className="text-[11px] font-semibold text-light-text-muted dark:text-text-muted">
                    • {tecnicoNome}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-light-text-main dark:text-text-main tracking-tight">
                Detalhamento de Peças Aplicadas
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-light-text-muted hover:text-light-text-main dark:text-text-muted dark:hover:text-text-main bg-light-border/40 hover:bg-light-border/60 dark:bg-surface-elevated dark:hover:bg-surface-hover rounded-xl transition-colors cursor-pointer"
            title="Fechar Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* BANNER INFORMATIVO DE ELEGIBILIDADE DA CAMPANHA */}
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-2.5 flex items-center gap-2 text-xs text-primary-dark dark:text-primary-light">
          <Layers size={15} className="text-primary shrink-0" />
          <span>
            <strong>Peças Elegíveis da Campanha:</strong> Exibindo exclusivamente chamados com aplicação de <strong>Placa Mãe</strong>, <strong>SSD</strong>, <strong>HD/HDD</strong> e <strong>Tela LCD</strong> (meta: ≤ 25.0%).
          </span>
        </div>

        {/* CARDS DE RESUMO KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 sm:p-6 bg-light-background/60 dark:bg-surface-elevated/40 border-b border-light-borderStrong/60 dark:border-border/60">
          <div className="bg-light-surface dark:bg-surface-elevated border border-light-borderStrong/60 dark:border-border p-3.5 rounded-xl shadow-xs">
            <span className="text-light-text-muted dark:text-text-muted font-medium uppercase text-[10px] block">Taxa de Consumo</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black ${percentualConsumo <= 25.0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {percentualConsumo.toFixed(1)}%
              </span>
              <span className="text-[10px] text-light-text-muted dark:text-text-muted font-semibold">Meta: ≤ 25.0%</span>
            </div>
          </div>

          <div className="bg-light-surface dark:bg-surface-elevated border border-light-borderStrong/60 dark:border-border p-3.5 rounded-xl shadow-xs">
            <span className="text-light-text-muted dark:text-text-muted font-medium uppercase text-[10px] block">Total de Peças</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-light-text-main dark:text-text-main">
                {pecas.length}
              </span>
              <span className="text-[10px] text-light-text-muted dark:text-text-muted font-semibold">peças aplicadas</span>
            </div>
          </div>

          <div className="bg-light-surface dark:bg-surface-elevated border border-light-borderStrong/60 dark:border-border p-3.5 rounded-xl shadow-xs">
            <span className="text-light-text-muted dark:text-text-muted font-medium uppercase text-[10px] block">Chamados com Peça</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-light-text-main dark:text-text-main">
                {totalChamadosUnicos}
              </span>
              <span className="text-[10px] text-light-text-muted dark:text-text-muted font-semibold">atendimentos</span>
            </div>
          </div>

          <div className="bg-light-surface dark:bg-surface-elevated border border-light-borderStrong/60 dark:border-border p-3.5 rounded-xl shadow-xs">
            <span className="text-light-text-muted dark:text-text-muted font-medium uppercase text-[10px] block">Pontuação do KPI</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-light-text-main dark:text-text-main">
                {pontosPecas.toFixed(1)}
              </span>
              <span className="text-[10px] text-light-text-muted dark:text-text-muted font-semibold">pts (peso 12.5%)</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS E BUSCA */}
        <div className="p-4 bg-light-background dark:bg-input-bg border-b border-light-borderStrong/60 dark:border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-muted dark:text-text-muted" size={15} />
            <input
              type="text"
              placeholder="Buscar por chamado, peça ou laudo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-light-surface dark:bg-surface-elevated border border-light-borderStrong dark:border-border rounded-xl pl-9 pr-4 py-2 text-xs text-light-text-main dark:text-text-main placeholder-light-text-muted dark:placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto w-full sm:w-auto overflow-x-auto scrollbar-hide text-xs">
            <span className="text-[11px] font-bold text-light-text-muted dark:text-text-muted uppercase flex items-center gap-1 mr-1">
              <Filter size={12} /> Categoria:
            </span>
            <button
              onClick={() => setCategoriaFiltro('TODAS')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'TODAS'
                  ? 'bg-primary text-black dark:text-black shadow-sm shadow-primary/20'
                  : 'bg-light-border/40 hover:bg-light-border/60 text-light-text-secondary dark:bg-surface-elevated dark:text-text-muted dark:hover:text-text-main dark:hover:bg-surface-hover'
              }`}
            >
              Todas ({contadores.TODAS})
            </button>
            <button
              onClick={() => setCategoriaFiltro('TELA')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'TELA'
                  ? 'bg-primary text-black dark:text-black shadow-sm shadow-primary/20'
                  : 'bg-light-border/40 hover:bg-light-border/60 text-light-text-secondary dark:bg-surface-elevated dark:text-text-muted dark:hover:text-text-main dark:hover:bg-surface-hover'
              }`}
            >
              Tela LCD ({contadores.TELA})
            </button>
            <button
              onClick={() => setCategoriaFiltro('SSD')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'SSD'
                  ? 'bg-primary text-black dark:text-black shadow-sm shadow-primary/20'
                  : 'bg-light-border/40 hover:bg-light-border/60 text-light-text-secondary dark:bg-surface-elevated dark:text-text-muted dark:hover:text-text-main dark:hover:bg-surface-hover'
              }`}
            >
              SSD ({contadores.SSD})
            </button>
            <button
              onClick={() => setCategoriaFiltro('HD')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'HD'
                  ? 'bg-primary text-black dark:text-black shadow-sm shadow-primary/20'
                  : 'bg-light-border/40 hover:bg-light-border/60 text-light-text-secondary dark:bg-surface-elevated dark:text-text-muted dark:hover:text-text-main dark:hover:bg-surface-hover'
              }`}
            >
              HD ({contadores.HD})
            </button>
            <button
              onClick={() => setCategoriaFiltro('PLM')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'PLM'
                  ? 'bg-primary text-black dark:text-black shadow-sm shadow-primary/20'
                  : 'bg-light-border/40 hover:bg-light-border/60 text-light-text-secondary dark:bg-surface-elevated dark:text-text-muted dark:hover:text-text-main dark:hover:bg-surface-hover'
              }`}
            >
              PLM ({contadores.PLM})
            </button>
          </div>
        </div>

        {/* CONTEÚDO: LISTA DE PEÇAS APLICADAS */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-light-text-muted dark:text-text-muted">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
              <p className="text-sm font-medium">Carregando peças aplicadas...</p>
            </div>
          ) : filteredPecas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-base font-bold text-light-text-main dark:text-text-main">Nenhuma Peça Encontrada</h3>
              <p className="text-xs text-light-text-muted dark:text-text-muted max-w-md mt-1">
                {searchTerm || categoriaFiltro !== 'TODAS'
                  ? 'Nenhuma peça corresponde aos filtros selecionados. Tente limpar os filtros.'
                  : 'Nenhum registro de aplicação de peça encontrado para o período selecionado.'}
              </p>
            </div>
          ) : (
            filteredPecas.map((item, idx) => {
              return (
                <div 
                  key={`${item.chamado}-${idx}`}
                  className="bg-light-surface dark:bg-surface-elevated/50 border border-light-borderStrong/70 dark:border-border/70 hover:border-light-borderStrong dark:hover:border-border rounded-xl p-4 sm:p-5 transition-all shadow-xs flex flex-col gap-3 group"
                >
                  {/* CABEÇALHO DO ITEM: OS, DATA, AÇÃO E GRUPO */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-light-borderStrong/40 dark:border-border/50 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-light-border/40 dark:bg-input-bg px-3 py-1 rounded-lg border border-light-borderStrong/60 dark:border-border/60">
                        <span className="text-[10px] text-light-text-muted dark:text-text-muted uppercase font-bold">OS:</span>
                        <strong className="text-xs font-mono font-bold text-light-text-main dark:text-text-main">#{item.chamado || 'N/D'}</strong>
                      </div>

                      <div className="text-xs text-light-text-muted dark:text-text-muted flex items-center gap-1.5">
                        <Clock size={13} className="text-light-text-muted dark:text-text-muted" />
                        <span>Atendimento: {formatDateTime(item.ft)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {item.grupoMercadoriaDesc && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-light-border/40 text-light-text-secondary border border-light-borderStrong/60 dark:bg-surface-elevated dark:text-text-muted dark:border-border/60">
                          {item.grupoMercadoriaDesc}
                        </span>
                      )}
                      {item.acao && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {item.acao}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* GRID DE INFORMAÇÕES DETALHADAS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    
                    {/* COLUNA 1: PEÇAS (APLICADA vs SOLICITADA) */}
                    <div className="bg-light-background/60 dark:bg-input-bg p-3.5 rounded-xl border border-light-borderStrong/60 dark:border-border/50 space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-light-text-muted dark:text-text-muted border-b border-light-borderStrong/40 dark:border-border/40 pb-2">
                          <span className="flex items-center gap-1 font-bold text-light-text-main dark:text-text-main">
                            <Cpu size={13} className="text-primary" />
                            Peça Aplicada em Campo
                          </span>
                        </div>

                        <div>
                          <span className="text-light-text-muted dark:text-text-muted font-medium block text-[10px] uppercase">Descrição da Peça Aplicada</span>
                          {item.subgrupo && (
                            <div className="mt-1 mb-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20 inline-block">
                                Subgrupo: {item.subgrupo}
                              </span>
                            </div>
                          )}
                          <strong className="text-primary-dark dark:text-primary-light font-semibold text-xs block mt-0.5">
                            {item.codAplicDesc || 'Peça aplicada não especificada'}
                          </strong>
                        </div>

                        {item.codSolicDesc && item.codSolicDesc !== item.codAplicDesc && (
                          <div className="pt-2 border-t border-light-borderStrong/40 dark:border-border/40">
                            <span className="text-light-text-muted dark:text-text-muted font-medium block text-[10px] uppercase">Peça Solicitada Originalmente</span>
                            <span className="text-light-text-secondary dark:text-text-muted font-medium flex items-center gap-1 mt-0.5">
                              <Package size={12} className="text-light-text-muted dark:text-text-muted shrink-0" />
                              <span className="truncate">{item.codSolicDesc}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* TÉCNICO EXECUTOR */}
                      <div className="pt-2 border-t border-light-borderStrong/40 dark:border-border/40">
                        <span className="text-light-text-muted dark:text-text-muted font-medium block text-[10px] uppercase">Técnico Executor</span>
                        <span className="text-light-text-main dark:text-text-main font-semibold flex items-center gap-1 mt-0.5">
                          <User size={13} className="text-light-text-muted dark:text-text-muted shrink-0" />
                          <span className="truncate">{item.tecnicoNome || 'Não informado'}</span>
                        </span>
                      </div>
                    </div>

                    {/* COLUNA 2: CONTEXTO DO CHAMADO & LAUDO */}
                    <div className="bg-light-background/60 dark:bg-input-bg p-3.5 rounded-xl border border-light-borderStrong/60 dark:border-border/50 space-y-2.5 flex flex-col justify-between">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-light-text-muted dark:text-text-muted border-b border-light-borderStrong/40 dark:border-border/40 pb-2">
                          <span className="flex items-center gap-1 font-bold text-light-text-main dark:text-text-main">
                            <FileText size={13} className="text-light-text-muted dark:text-text-muted" />
                            Contexto do Atendimento
                          </span>
                          {item.assistenciaCidade && (
                            <span className="font-semibold text-light-text-muted dark:text-text-muted flex items-center gap-1 text-[10px]">
                              <Building2 size={11} className="text-light-text-muted dark:text-text-muted" />
                              {item.assistenciaCidade}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-light-text-muted dark:text-text-muted font-medium block text-[10px] uppercase">Equipamento</span>
                            <span className="text-light-text-main dark:text-text-main font-semibold flex items-center gap-1 mt-0.5">
                              <Wrench size={12} className="text-light-text-muted dark:text-text-muted shrink-0" />
                              <span className="truncate">{item.tipoEquipamento || 'Não especificado'}</span>
                            </span>
                          </div>

                          <div>
                            <span className="text-light-text-muted dark:text-text-muted font-medium block text-[10px] uppercase">Projeto</span>
                            <span className="text-light-text-main dark:text-text-main font-semibold flex items-center gap-1 mt-0.5">
                              <Layers size={12} className="text-light-text-muted dark:text-text-muted shrink-0" />
                              <span className="truncate">{item.projeto || 'Corporativo'}</span>
                            </span>
                          </div>
                        </div>

                        {/* LAUDO TÉCNICO */}
                        <div>
                          <span className="text-light-text-muted dark:text-text-muted font-medium block text-[10px] uppercase">Laudo Técnico / Encerramento</span>
                          {item.textoEncerrado ? (
                            <div className="text-[11px] text-light-text-secondary dark:text-text-main bg-light-border/40 dark:bg-background/80 p-2.5 rounded-lg border border-light-borderStrong/60 dark:border-border mt-1 max-h-24 overflow-y-auto scrollbar-hide pr-1.5 leading-relaxed font-mono select-text">
                              {item.textoEncerrado}
                            </div>
                          ) : (
                            <div className="text-[11px] text-light-text-muted dark:text-text-muted italic bg-light-border/20 dark:bg-background/40 p-2 rounded-lg border border-light-borderStrong/40 dark:border-border/40 mt-1">
                              Texto de encerramento não registrado.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER DO MODAL */}
        <div className="p-4 bg-light-background dark:bg-input-bg border-t border-light-borderStrong/60 dark:border-border/60 flex items-center justify-between text-xs text-light-text-muted dark:text-text-muted">
          <span>
            Mostrando <strong className="text-light-text-main dark:text-text-main">{filteredPecas.length}</strong> de <strong className="text-light-text-main dark:text-text-main">{pecas.length}</strong> peças aplicadas
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-light-border/60 hover:bg-light-border/80 text-light-text-main dark:bg-surface-elevated dark:hover:bg-surface-hover dark:text-text-main font-semibold rounded-xl transition-colors cursor-pointer border border-transparent dark:border-border/50"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
